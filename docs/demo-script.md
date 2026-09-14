# 5-minute demo script (interviews + placement talks)

## 0:00–0:30 — headline
"COD settlement reconciliation on 25k shipments: **₹22.3L leakage, 23.1% dispute rate**,
cut to the exact courier × tier × type cell in one screen."

## 0:30–1:30 — dashboard (`dashboard/`, `npm run dev`)
KPI header → weekly trend spike → Pareto (Shiprocket 45% of leakage) →
RCA workbench: filter Tier-3 → Bluedart weight cell → auto 5-Why read.

## 1:30–2:30 — SQL (SSMS, `warehouse/queries/mssql/`)
`02_courier_scorecard.sql` Q4: reliability `RANK()` window.
`03_rca_drilldown.sql` Q7: `LAG()` WoW spike. Say: "OA shortlisting is SQL — these are that SQL."

## 2:30–3:30 — Python (`python/scripts/`)
`02_hypothesis_tests.py`: Bluedart Tier-3 +12.98%, p≈6e-256; festival χ².
`04_forecast.py`: +₹7k/week trend, 4-week forecast.

## 3:30–4:30 — pipeline (`engine/`)
`sp_reconcile_batch`: 7 set-based rules, idempotent. Kafka topic `discrepancy.events`:
6,456 events, verified on broker. PowerBI: 4 datasets + 8 DAX measures.

## 4:30–5:00 — close with case
"Same data answers your Tier-2 entry case: leakage flat at ~2.4% of GMV, SLA is the
blocker — details in `case-studies/blinkit_tier2_entry.md`."
