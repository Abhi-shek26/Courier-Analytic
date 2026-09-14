"""03 Courier reliability scorecard (mirrors warehouse Q4 in pandas).

score = 100 * (0.4*ontime + 0.35*(1-dispute_rate) + 0.25*(1-phantom_rate))
Saves python/outputs/courier_scorecard.csv
"""
import pathlib
from db import query

OUT = pathlib.Path(__file__).parent.parent / "outputs"
OUT.mkdir(exist_ok=True)

df = query("""SELECT cu.courier_name,
  COUNT(*) orders_,
  AVG(CASE WHEN o.actual_eta_hrs <= o.promised_eta_hrs THEN 1.0 ELSE 0.0 END) ontime,
  CAST(COUNT(DISTINCT d.awb_number) AS FLOAT)/COUNT(DISTINCT o.awb_number) dispute,
  AVG(CASE WHEN d.discrepancy_type='PHANTOM_RTO_CHARGE' THEN 1.0 ELSE 0.0 END) phantom,
  COALESCE(SUM(d.variance_rs),0) leakage
  FROM dbo.fact_orders o JOIN dbo.dim_courier cu ON cu.courier_id=o.courier_id
  LEFT JOIN dbo.fact_discrepancies d ON d.awb_number=o.awb_number
  GROUP BY cu.courier_name""")
df["reliability"] = (0.4 * df.ontime + 0.35 * (1 - df.dispute)
                     + 0.25 * (1 - df.phantom.fillna(0))) * 100
df["rank"] = df.reliability.rank(ascending=False).astype(int)
df = df.sort_values("rank")
df.to_csv(OUT / "courier_scorecard.csv", index=False)
print(df[["rank", "courier_name", "orders_", "reliability", "leakage"]].to_string(index=False))
print(f"\nsaved -> {OUT / 'courier_scorecard.csv'}")
