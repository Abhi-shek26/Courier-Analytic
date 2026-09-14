# Courier-Analytic

> Blinkit-style COD settlement reconciliation + leakage RCA system.
> Built for **Product Analyst** interviews (Eternal/Zomato track): SQL-first, Python-validated, business impact in ₹.

**North-star:** Recoverable leakage detected (₹) · **Inputs:** dispute rate %, DSO days, courier reliability score.

## Why this exists
Courier settlement files rarely match reality: COD short-remitted, weight inflated, phantom RTO on delivered orders, overdue remittance, duplicate AWBs. This system ingests 25k shipments over 90 days, reconciles against orders via 7 rules, streams discrepancy events through Kafka, models them in an MS SQL Server star schema (Postgres/Snowflake DDL kept as portable siblings), validates with Python stats, and serves RCA via API + dashboard + PowerBI.

## 5-min demo (SSMS-first)
1. Create DB `CourierAnalytic` in SSMS → run `warehouse/ddl/mssql/schema.sql`
2. `cd warehouse/seed && npm run generate` → 25k rows → `BULK INSERT` via `warehouse/ddl/mssql/load_sample.sql`
3. Run any `warehouse/queries/mssql/*.sql` in SSMS (RANK, LAG, ROW_NUMBER, NTILE)
4. `docker compose up -d` → redpanda (kafka) + mssql → `npm run reconcile` → Kafka `discrepancy.events`
4. Open dashboard → Leakage ₹, Pareto by courier, Funnel, Courier Scorecard, RCA workbench
5. Open `/warehouse/queries/` → run `courier_scorecard.sql` (window + rank)
6. Open `/python/notebooks/01_eda.ipynb` → t-test: Bluedart Tier-3 overcharge significant?

## Stack (PA-first, production-flavoured)
- **Warehouse (PRIMARY):** MS SQL Server — `warehouse/ddl/mssql/`, queries `warehouse/queries/mssql/` (T-SQL, SSMS-ready)
- **Warehouse (portable):** Postgres + Snowflake DDL kept in sync (same grain)
- **Streaming:** Kafka (Redpanda locally) — `settlement.raw`, `discrepancy.events`
- **Transform:** dbt-style SQL models `/warehouse/models/` (staging → marts)
- **Engine:** Node.js reconciliation (ported + hardened from FEA, 7 rules)
- **Analytics:** Python pandas/scipy/sklearn, notebooks + scripts
- **Serving:** Express KPI API + React dashboard + PowerBI dataset (`/powerbi/` + DAX)
- **Ops:** Docker Compose, node-cron SLA job, idempotency keys, Great Expectations-style checks

## Repo map
```
PLAN.md                  — full build plan + level gates
/warehouse/ddl/          — star schema (postgres + snowflake)
/warehouse/models/       — staging → marts SQL
/warehouse/queries/      — 15 interview-ready analyst queries
/warehouse/seed/         — deterministic 25k seeder
/engine/                 — reconciliation (7 rules) + kafka producer/consumer
/api/                    — KPI serving API
/python/                 — notebooks + scorecard + forecast
/dashboard/              — React product dashboard
/powerbi/                — curated CSVs + measures.dax + build-guide
/case-studies/           — RCA, Tier-2 entry, metrics, guesstimate
/docs/                   — architecture, screenshots
```

## Rules (engine/)
1. COD_SHORT_REMITTANCE — `settled < cod - min(2%, ₹10)`
2. WEIGHT_DISPUTE — `charged > declared * 1.10`
3. PHANTOM_RTO_CHARGE — `rto > 0 AND status = DELIVERED`
4. OVERDUE_REMITTANCE — `settlement delay > 14d`
5. DUPLICATE_SETTLEMENT — same AWB in multiple batches (`ROW_NUMBER()`)
6. ETA_SLA_BREACH — `actualETA > promisedETA * 1.3` (Blinkit-style SLA)
7. EXCESS_FORWARD_CHARGE — `forward > slab(weight, tier) * 1.15`

## Status
- [x] L0 scaffold + plan
- [ ] L1 warehouse + seed + SQL
- [ ] L2 streaming + engine
- [ ] L3 python analytics
- [ ] L4 dashboard + powerbi
- [ ] L5 case studies + v1.0-pa-ready

See `PLAN.md` for level-wise commits and push gates.
