"""05 Export: MSSQL -> dashboard/public/data/*.json + powerbi/dataset/*.csv.

Single source for L4 serving layer. Re-run after each reconcile:
    python scripts/05_export_dashboard.py
"""
import json
import pathlib
import pandas as pd
from db import query

ROOT = pathlib.Path(__file__).resolve().parents[2]
DASH = ROOT / "dashboard" / "public" / "data"
PBI = ROOT / "powerbi" / "dataset"
DASH.mkdir(parents=True, exist_ok=True)
PBI.mkdir(parents=True, exist_ok=True)

# --- header KPIs ---
k = query("""SELECT COUNT(DISTINCT s.awb_number) settled,
  COUNT(DISTINCT d.awb_number) disputed,
  COALESCE(SUM(d.variance_rs),0) leakage,
  AVG(CAST(DATEDIFF(DAY,o.order_date,s.settlement_date) AS FLOAT)) dso
  FROM dbo.fact_settlements s LEFT JOIN dbo.fact_discrepancies d
  ON d.awb_number=s.awb_number AND d.batch_id=s.batch_id
  LEFT JOIN dbo.fact_orders o ON o.awb_number=s.awb_number""").iloc[0]
kpis = {"settled_awbs": int(k.settled), "disputed_awbs": int(k.disputed),
        "dispute_rate_pct": round(100 * k.disputed / k.settled, 2),
        "leakage_rs": float(k.leakage), "avg_dso_days": round(float(k.dso), 1)}
(DASH / "kpis.json").write_text(json.dumps(kpis, indent=1))
print("kpis:", kpis)

# --- weekly trend ---
trend = query("""SELECT CONVERT(NVARCHAR(10), DATEADD(WEEK, DATEDIFF(WEEK,0,s.settlement_date),0), 23) wk,
  COUNT(*) settlements, COUNT(d.awb_number) disputes, COALESCE(SUM(d.variance_rs),0) leakage
  FROM dbo.fact_settlements s LEFT JOIN dbo.fact_discrepancies d
  ON d.awb_number=s.awb_number AND d.batch_id=s.batch_id
  GROUP BY DATEADD(WEEK, DATEDIFF(WEEK,0,s.settlement_date),0) ORDER BY 1""")
trend.to_json(DASH / "trend.json", orient="records", indent=1)

# --- pareto by courier (with running %) ---
par = query("""SELECT cu.courier_name courier_, SUM(d.variance_rs) leakage, COUNT(*) cases_
  FROM dbo.fact_discrepancies d JOIN dbo.dim_courier cu ON cu.courier_id=d.courier_id
  GROUP BY cu.courier_name ORDER BY leakage DESC""")
tot = par.leakage.sum()
par["pct"] = (100 * par.leakage / tot).round(1)
par["running_pct"] = (100 * par.leakage.cumsum() / tot).round(1)
par.to_json(DASH / "pareto.json", orient="records", indent=1)

# --- funnel: orders -> delivered -> settled -> matched/disputed ---
f = query("""SELECT COUNT(*) orders_, SUM(CASE WHEN order_status='DELIVERED' THEN 1 ELSE 0 END) delivered
  FROM dbo.fact_orders""").iloc[0]
funnel = [{"stage": "Orders", "n": int(f.orders_)},
          {"stage": "Delivered", "n": int(f.delivered)},
          {"stage": "Settled", "n": int(kpis["settled_awbs"])},
          {"stage": "Matched", "n": int(kpis["settled_awbs"] - kpis["disputed_awbs"])},
          {"stage": "Disputed", "n": int(kpis["disputed_awbs"])}]
(DASH / "funnel.json").write_text(json.dumps(funnel, indent=1))

# --- scorecard (recompute, mirrors Q4) ---
sc = query("""SELECT cu.courier_name courier_, COUNT(*) orders_,
  AVG(CASE WHEN o.actual_eta_hrs <= o.promised_eta_hrs THEN 1.0 ELSE 0.0 END) ontime,
  CAST(COUNT(DISTINCT d.awb_number) AS FLOAT)/COUNT(DISTINCT o.awb_number) dispute,
  COALESCE(AVG(CASE WHEN d.discrepancy_type='PHANTOM_RTO_CHARGE' THEN 1.0 ELSE 0.0 END),0) phantom,
  COALESCE(SUM(d.variance_rs),0) leakage
  FROM dbo.fact_orders o JOIN dbo.dim_courier cu ON cu.courier_id=o.courier_id
  LEFT JOIN dbo.fact_discrepancies d ON d.awb_number=o.awb_number GROUP BY cu.courier_name""")
sc["reliability"] = (0.4 * sc.ontime + 0.35 * (1 - sc.dispute) + 0.25 * (1 - sc.phantom)) * 100
sc["reliability"] = sc.reliability.round(1)
sc["rank"] = sc.reliability.rank(ascending=False).astype(int)
sc = sc.sort_values("rank")
sc.to_json(DASH / "scorecard.json", orient="records", indent=1)
sc.to_csv(PBI / "courier_scorecard.csv", index=False)

# --- RCA cells: courier x tier x type (top 60) ---
cells = query("""SELECT TOP 60 cu.courier_name courier_, ge.tier,
  d.discrepancy_type dtype, COUNT(*) cases_, SUM(d.variance_rs) leakage,
  AVG(d.variance_rs) avg_loss
  FROM dbo.fact_discrepancies d JOIN dbo.dim_courier cu ON cu.courier_id=d.courier_id
  JOIN dbo.dim_geography ge ON ge.geo_id=d.geo_id
  GROUP BY cu.courier_name, ge.tier, d.discrepancy_type ORDER BY leakage DESC""")
cells["avg_loss"] = cells.avg_loss.round(0)
cells.to_json(DASH / "rca_cells.json", orient="records", indent=1)

# --- merchant health (RFM-lite) ---
m = query("""SELECT o.merchant_id merchant_, me.category, COUNT(*) orders_,
  SUM(o.order_value) gmv, COALESCE(SUM(d.variance_rs),0) leakage,
  CAST(COUNT(d.awb_number) AS FLOAT)/COUNT(*) dispute_rate
  FROM dbo.fact_orders o JOIN dbo.dim_merchant me ON me.merchant_id=o.merchant_id
  LEFT JOIN dbo.fact_discrepancies d ON d.awb_number=o.awb_number
  GROUP BY o.merchant_id, me.category""")
m["value_quartile"] = pd.qcut(m.gmv, 4, labels=["Q4", "Q3", "Q2", "Q1"])
m["health"] = pd.cut(m.dispute_rate, [-0.01, 0.15, 0.30, 2.0], labels=["healthy", "watchlist", "high-risk"])
m.to_json(DASH / "merchants.json", orient="records", indent=1)
m.to_csv(PBI / "merchant_health.csv", index=False)

# --- tier entry math ---
te = query("""SELECT ge.tier, COUNT(*) orders_, SUM(o.order_value) gmv,
  COALESCE(SUM(d.variance_rs),0) leakage,
  AVG(o.actual_eta_hrs - o.promised_eta_hrs) delay
  FROM dbo.fact_orders o JOIN dbo.dim_geography ge ON ge.geo_id=o.geo_id
  LEFT JOIN dbo.fact_discrepancies d ON d.awb_number=o.awb_number GROUP BY ge.tier""")
te.to_json(DASH / "tier_entry.json", orient="records", indent=1)

# --- Olist validation snapshot (from 06 output, for dashboard panel) ---
import shutil
shutil.copy(pathlib.Path(__file__).parent.parent / "outputs" / "olist_validation.json",
            DASH / "olist.json")

# --- PowerBI datasets ---
query("""SELECT CONVERT(NVARCHAR(10), k.kpi_date, 23) kpi_date, cu.courier_name courier_,
  ge.city, ge.tier, k.orders, k.disputed_awbs, k.leakage_rs, k.avg_dso_days
  FROM dbo.fct_daily_kpis k JOIN dbo.dim_courier cu ON cu.courier_id=k.courier_id
  JOIN dbo.dim_geography ge ON ge.geo_id=k.geo_id""").to_csv(PBI / "kpi_daily.csv", index=False)
query("""SELECT d.awb_number, d.batch_id, cu.courier_name courier_, d.merchant_id,
  ge.city, ge.tier, d.discrepancy_type, d.expected_value, d.actual_value,
  d.variance_rs, d.severity, d.detected_at
  FROM dbo.fact_discrepancies d JOIN dbo.dim_courier cu ON cu.courier_id=d.courier_id
  JOIN dbo.dim_geography ge ON ge.geo_id=d.geo_id""").to_csv(PBI / "discrepancies.csv", index=False)
print(f"dashboard json -> {DASH} | powerbi csv -> {PBI}")
