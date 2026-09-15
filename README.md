# Courier-Analytic

> COD settlement reconciliation + leakage RCA for e-commerce logistics.
> **₹22,34,719 leakage · 5,774 disputed AWBs (23.1%) · 25,000 shipments · 90 days**
>
> Live demo: https://courier-analytic.vercel.app/ · PowerBI: `powerbi/Courier-Analytic.pbix` + [overview](docs/img/powerbi_overview.png)

## The problem it solves

You order shoes worth ₹2,000 Cash on Delivery. The agent collects ₹2,000 and
hands it to the courier (Delhivery, Bluedart…). Later the courier must
**settle** — transfer that ₹2,000 to the shopkeeper minus delivery charges.

A shopkeeper shipping 25,000 parcels a month through 5 couriers receives a big
CSV from each courier: "here's what we delivered, here's the money." Someone
must check: *did I get the right money for every parcel?* Nobody checks
properly, so money leaks — short remittances, inflated weights, phantom return
fees, month-late payouts, double settlements.

One parcel, walked through — shop record
`AWB100001 · COD ₹5,000 · 2 kg · DELIVERED` vs courier file
`transferred ₹4,600 · charged 2.5 kg · RTO ₹150` →
verdict: COD short ₹400 + weight inflated 25% + phantom RTO ₹150.
Scale that to thousands of parcels → **₹22.3 lakh across 5,774 parcels.**
This project is that check, automated end to end.

## 5-minute demo

1. **Dashboard** — `cd dashboard && npm install && npm run dev`: Overview
   landing → Analyse tabs (Warehouse 25k · Olist 99k) → ✨ AI analysis dock.
2. **SQL** — SSMS on `CourierAnalytic`:
   `warehouse/queries/mssql/02_courier_scorecard.sql` (RANK),
   `03_rca_drilldown.sql` (LAG).
3. **Python** — `python/scripts/02_hypothesis_tests.py`: Bluedart Tier-3
   +12.98% (p≈6e-256); festival χ² (p≈2e-56).
4. **Pipeline** — `EXEC dbo.sp_reconcile_batch`; Kafka `discrepancy.events`
   (6,456 events); PowerBI (`powerbi/build-guide.md`).

## Result table (live MSSQL, 2026-09-14)

| Cut | Finding |
|---|---|
| By type | Duplicates ₹9.08L · Overdue ₹7.72L · Phantom RTO ₹2.90L · COD short ₹1.78L |
| By courier | Shiprocket ₹10.09L · Delhivery ₹4.56L · Bluedart ₹2.91L |
| Scorecard | Shiprocket 72.2 → Delhivery 70.2 → Bluedart 69.7 → Kwikship 68.4 → DTDC 63.7 |
| Forecast | +₹7k/week trend (Ridge R²=0.32), 4-week forecast in `python/outputs/` |
| Real-data proof | Olist 99,441 orders: 8.1% late → 65.3% bad reviews vs 17.2% on-time |

## Architecture

```
                  ┌─ courier settlement CSVs ─┐
CSV seed (25k) ───┤  Olist raw (99k, real)     ├──▶ 🗄️ MSSQL warehouse (CourierAnalytic, star schema)
                  └────────────────────────────┘         │
                                                         ▼
                                              ⚙️ sp_reconcile_batch — 7 rules, idempotent
                                                         │  rupee variance + HIGH/MEDIUM/LOW
                                                         ▼
                                              fact_discrepancies (6,456 rows)
                                               │                    │
                       ┌───────────────────────┘                    └──────────────────────┐
                       ▼                                                                 ▼
        🛰️ Kafka KRaft · discrepancy.events                        🐍 Python stats (t-test/χ²/scorecard/forecast)
        alerts · ledger · dispute tools                                    │
                       └───────────────────────┬───────────────────────────┘
                                               ▼
                        ⚛️ React dashboard ── Overview · Analyse (both datasets) · 🤖 Gemini dock
                        📊 PowerBI pack ── 7 CSVs · 12 DAX · .pbix report
```

How the pieces work together: settlement and order rows land in the
warehouse; the stored procedure reconciles them set-wise into priced
mismatches; each mismatch is published to Kafka so downstream consumers
(alerts, ledgers, claim tools) react without slowing the engine; Python
proves which patterns are statistically real and scores every courier;
the dashboard and PowerBI serve the same numbers to analysts and managers;
the Gemini dock explains any chart on demand from the live JSON.

| Piece | Functionality | Key files |
|---|---|---|
| 🗄️ Warehouse | Star schema (dims + facts + daily KPI mart); 6 analyst queries with RANK, LAG, NTILE; 25k deterministic seed with injected RCA signals | `warehouse/ddl/mssql/`, `warehouse/queries/mssql/`, `warehouse/seed/`, `warehouse/models/` |
| ⚙️ Engine | 7 set-based T-SQL rules, idempotent per batch; Python runner exports JSONL and publishes 6,456 Kafka events | `engine/sql/reconcile.sql`, `engine/reconcile.py`, `engine/publish_events.py` |
| 🐍 Analytics | EDA → hypothesis tests → reliability scorecard → Ridge forecast → dashboard JSON + Olist validation exports | `python/scripts/01–07`, `python/outputs/` |
| ⚛️ Dashboard | Light-theme site: Overview explainer + Warehouse/Olist Analyse views (trend, Pareto, treemaps, radar, bubble scatter, RCA workbench) | `dashboard/src/`, `dashboard/public/data/` |
| 🤖 AI dock | Per-chart Gemini analysis (project brief + chart data + task) in a side panel; cached, lite-primary with fallback + retry | `dashboard/src/ai.js`, `dashboard/src/AIAnalysis.jsx` |
| 📊 PowerBI | 7 ready CSVs, 12 DAX measures, ~25-min build guide, shipped `.pbix` + overview screenshot | `powerbi/dataset/`, `powerbi/measures.dax` |
| 📁 Cases + docs | Revenue-drop RCA, Tier-2 expansion, metrics glossary, guesstimate, plain-language explainer | `case-studies/`, `docs/` |

## Why this stack

| Tech | Why it earned its place |
|---|---|
| MS SQL Server | Logistics analytics teams live in SQL Server. Window functions, CTEs and stored procedures keep the reconciliation where the data is — set-based, repeatable, auditable. Postgres/Snowflake DDL ships too for portability. |
| 🛰️ Apache Kafka (KRaft) | Settlement checking is a streaming problem at real scale: thousands of discrepancies per batch, multiple consumers (SMS alerts, finance ledger, dispute tools) that must not slow the engine. A `discrepancy.events` topic decouples producers from consumers; KRaft drops ZooKeeper so the whole backbone runs as one local container (`localhost:29092`). A batch job alone couldn't do that. |
| 🐍 Python (pandas/scipy/sklearn) | Gut feel doesn't win arguments — p-values do. Welch t-tests and chi-square prove the injected signals are systematic; the scorecard ranks couriers; Ridge forecasts next month's leakage. |
| ⚛️ React + Recharts on static JSON | Zero-backend demo that deploys anywhere (Vercel). MSSQL → JSON exports mean the site always shows the exact warehouse numbers, no mockups. |
| 📊 PowerBI | Managers open pbix files, not terminals. Same datasets, 12 DAX measures, rebuildable in ~25 minutes. |
| 🤖 Gemini (free tier) | Every chart carries a data-grounded analyst: project brief + that chart's JSON + a focused task, answered as show/why/action. Lite model first for speed, full Flash fallback, cached per chart. |

## The 7 reconciliation rules

| Rule | Trigger | Variance (₹) |
|---|---|---|
| `COD_SHORT_REMITTANCE` | Settled < COD − min(2%, ₹10) | Shortfall |
| `WEIGHT_DISPUTE` | Charged > declared × 1.10 | Excess kg × ₹60 |
| `PHANTOM_RTO_CHARGE` | RTO fee > 0 on DELIVERED | RTO charge |
| `OVERDUE_REMITTANCE` | DSO > 14 days | Cash stuck |
| `DUPLICATE_SETTLEMENT` | AWB in > 1 batch (HIGH) | Settled COD |
| `ETA_SLA_BREACH` | Actual > promised × 1.3 | 0 (hits dispute rate) |
| `EXCESS_FORWARD_CHARGE` | Forward > slab × 1.15 | Excess |

Severity: HIGH > ₹500 · MEDIUM > ₹100 · else LOW. Re-runs are safe
(idempotent per batch).

## Datasets

- **Warehouse · synthetic 25k** — 5 couriers × Tier-1/2/3 × Grocery/Food/Pharmacy
  × COD/Prepaid × Diwali-week flag, with injected signals (Bluedart Tier-3
  weight +13%, Shiprocket festival overdue spike, Delhivery high-value COD
  shortfall, phantom RTO on DELIVERED). The stats suite is designed to catch
  exactly these.
- **Olist · real 99,441 orders** — Kaggle's Brazilian e-commerce data through
  the same logic: 8.1% late (avg 9.6 days), 249 payment mismatches, 983 freight
  outliers, late → 65.3% bad reviews vs 17.2% on-time (χ²=9833). Raw tables live
  in MSSQL beside the warehouse tables (`warehouse/ddl/mssql/raw_olist.sql`).

## AI chart analysis

Each Analyse chart has an ✨ button. Results open in a fixed side dock, so
page layout never shifts and the chart stays visible beside its explanation.
Setup — key lives in `dashboard/.env` (git-ignored, never committed):

```bash
VITE_GEMINI_API_KEY=<your-gemini-key>
```

For deploys, set `VITE_GEMINI_API_KEY` in the host's environment variables
(Vercel → project Settings) instead. A build without it still works; the
buttons just report the key as missing. Details: `dashboard/README.md`.

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
docker compose up -d kafka && cd ../engine && pip install -r requirements.txt && python reconcile.py
cd ../dashboard && npm install && npm run dev
```

Data is synthetic with injected RCA signals (see `python/README.md`) — the tests are designed to catch them.
Status: `v1.1` (Olist real-data + Kafka KRaft + pbix). Full walkthrough: `docs/`.

## Will this run on real company data? Yes — ~80% transfers directly

Same schema, same 7 rules, same queries, same statistics, same dashboard and
Kafka pattern. Point it at real courier CSVs with the same columns and it
runs — Olist is the proof. The remaining 20% to harden: daily auto-fetch from
courier portals/APIs, real per-courier rate cards (the ₹60/kg proxy is a
placeholder), logins + audit trail, managed Kafka, and a dispute-recovery loop
(file claims, track money recovered).
