# Courier-Analytic

> COD settlement reconciliation + leakage RCA for e-commerce logistics.
> **₹22,34,719 leakage · 5,774 disputed AWBs (23.1%) · 25,000 shipments · 90 days**
>
> Live demo: _(paste Vercel URL here)_ · PowerBI: `powerbi/Courier-Analytic.pbix` + [overview](docs/img/powerbi_overview.png)

## 5-minute demo
1. **Dashboard** — `cd dashboard && npm install && npm run dev`: KPI header → trend → Pareto → RCA workbench.
2. **SQL** — SSMS on `CourierAnalytic`: `warehouse/queries/mssql/02_courier_scorecard.sql` (RANK), `03_rca_drilldown.sql` (LAG).
3. **Python** — `python/scripts/02_hypothesis_tests.py`: Bluedart Tier-3 +12.98% (p≈6e-256); festival χ² (p≈2e-56).
4. **Pipeline** — `EXEC dbo.sp_reconcile_batch`; Kafka `discrepancy.events` (6,456 events); PowerBI (`powerbi/build-guide.md`).

## Result table (live MSSQL, 2026-09-14)
| Cut | Finding |
|---|---|
| By type | Duplicates ₹9.08L · Overdue ₹7.72L · Phantom RTO ₹2.90L · COD short ₹1.78L |
| By courier | Shiprocket ₹10.09L · Delhivery ₹4.56L · Bluedart ₹2.91L |
| Scorecard | Shiprocket 72.2 → Delhivery 70.2 → Bluedart 69.7 → Kwikship 68.4 → DTDC 63.7 |
| Forecast | +₹7k/week trend (Ridge R²=0.32), 4-week forecast in `python/outputs/` |

## Architecture
```
CSV seed (25k, deterministic signals) → MSSQL star schema (CourierAnalytic)
  → sp_reconcile_batch, 7 rules, idempotent → fact_discrepancies
  → Python runner → Kafka discrepancy.events (Redpanda) → fct_daily_kpis mart
  → Python stats (t-test/χ²/scorecard/forecast) → React dashboard + PowerBI
```
- **Warehouse (primary):** MS SQL Server — `warehouse/ddl/mssql/`, 16 T-SQL queries in `warehouse/queries/mssql/` (RANK, PARTITION BY, LAG, ROW_NUMBER, NTILE, PERCENTILE_CONT). Postgres/Snowflake DDL kept portable.
- **Engine:** `engine/sql/reconcile.sql` — 7 set-based rules with severity; `engine/reconcile.py` + `publish_events.py`.
- **Analytics:** `python/scripts/` 01 EDA → 02 tests → 03 scorecard → 04 forecast → 05 export. Charts in `docs/img/`.
- **Serving:** `dashboard/` (React + Recharts, static JSON, `npm run build` verified) + `powerbi/` (4 datasets, `measures.dax`, 10-min guide).
- **Cases:** `case-studies/` — revenue-drop RCA, Tier-2 expansion, metrics glossary, guesstimate.

## Local run (SSMS-first)
```bash
# 1. DB
sqlcmd -S localhost -E -C -Q "IF DB_ID('CourierAnalytic') IS NULL CREATE DATABASE CourierAnalytic"
sqlcmd -S localhost -E -C -d CourierAnalytic -i warehouse/ddl/mssql/schema.sql
# 2. Seed + load
cd warehouse/seed && npm run generate && pip install pyodbc && python load_mssql.py --dir ./output
# 3. Reconcile + mart
sqlcmd -S localhost -E -C -d CourierAnalytic -Q "EXEC dbo.sp_reconcile_batch @batchId = NULL"
sqlcmd -S localhost -E -C -d CourierAnalytic -i warehouse/models/marts/fct_daily_kpis_mssql.sql
# 4. Analytics + exports
cd ../../python && pip install -r requirements.txt && python scripts/01_eda.py && python scripts/02_hypothesis_tests.py && python scripts/03_scorecard.py && python scripts/04_forecast.py && python scripts/05_export_dashboard.py
# 5. Kafka (optional) + dashboard
docker compose up -d redpanda && cd ../engine && pip install -r requirements.txt && python reconcile.py
cd ../dashboard && npm install && npm run dev
```

Data is synthetic with injected RCA signals (see `python/README.md`) — the tests are designed to catch them.
Status: `v1.0-pa-ready`. Full walkthrough: `docs/`.
