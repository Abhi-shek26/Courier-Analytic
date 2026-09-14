# Courier Leakage Analytic — Build Plan (Eternal Product Analyst Target)

> Status: PLANNING APPROVED → EXECUTION IN LEVELS
> Location: `C:\Users\HELLO\Desktop\Codings\Courier Leakage Analytic`
> Source reuse: `../FEA` (5 reconciliation rules, seed patterns, notification retry logic)
> Goal: Not a backend CRUD. A Product Analytics system that an Eternal PA interviewer can interrogate for 60 minutes.

## 1. Why separate repo (agreed)

- `FEA` stays as SDE/backend proof (Node+Mongo+Redis+Bull). Do not touch it.
- New repo is PA-first: SQL + Python + Stats + RCA + Metrics + Business impact in ₹.
- Clean commit history: ~18 incremental commits over 10-14 days, not 1 dump.

## 2. High-level architecture (serious, not toy)

```
CSV Upload / Order Events
        ↓
[Kafka] topics: settlement.raw, order.events  (Redpanda/Kafka via Docker, local)
        ↓
Reconciliation Engine (Node.js, ported + hardened from FEA)
  - 7 rules: COD_SHORT, WEIGHT_DISPUTE, PHANTOM_RTO, OVERDUE_14D,
             DUPLICATE_AWB, ETA_SLA_BREACH, EXCESS_FORWARD_CHARGE
        ↓
[Warehouse] Postgres 16 (local) ↔ Snowflake (prod DDL provided)
  Star schema: dim_courier, dim_merchant, dim_geo, dim_date,
               fact_orders, fact_settlements, fact_discrepancies, fct_daily_kpis
  Transform: dbt-style SQL models in /warehouse/models (staging → marts)
        ↓
[Python Analytics] pandas + scipy + sklearn
  EDA, hypothesis tests, courier scorecard, leakage forecast
        ↓
[Serving] Express KPI API + React Dashboard + PowerBI dataset
  PowerBI: curated CSV exports + build guide + DAX measures
```

Why this stack for PA interviews:
- Kafka → shows streaming thinking (Blinkit-scale). Local via Redpanda, no cloud cost.
- Snowflake → we ship Snowflake DDL + Postgres for local run. Same SQL (window fns, CTEs). Interviewer sees Snowflake on resume, can run Postgres locally.
- PowerBI → recruiters love it. We ship both: web dashboard (for demo) + PowerBI guide + DAX (for resume keyword).
- dbt-style → shows analytics engineering maturity without needing dbt Cloud.
- Docker Compose → one-command run: postgres + redpanda + api + worker.

## 3. Data design (what makes it non-toy)

- Volume: 25,000 orders / 25,000 settlements / 90 days (vs FEA 60 rows).
- Dimensions: courier (5), cityTier (Tier-1/2/3), city (Mumbai, Indore, Pune, Jaipur...), merchantCategory (Grocery, Food, Pharmacy), paymentMode (COD/Prepaid), festival flag (Diwali week).
- Intentional signals (for RCA stories):
  - Bluedart Tier-3 weight dispute 22%
  - Shiprocket Diwali-week overdue spike
  - Delhivery COD shortfall on high-value COD
  - Phantom RTO on DELIVERED cluster
- Grain: one row per AWB per batch. SCD: keep settlement history.

Star schema DDL lives in `/warehouse/ddl/`. Seed in `/warehouse/seed/` (Node, deterministic with seeded RNG, not Math.random).

## 4. Execution levels + commits + push gates

### L0 — Scaffold (this commit)
- Folders, README skeleton, PLAN.md, .gitignore, docker-compose skeleton
- Commits: `chore: scaffold Courier Leakage Analytic repo with plan`
- Push gate: init git, create GitHub repo `Courier-Leakage-Analytic`, push main.

### L1 — Warehouse + SQL (3 commits)
- `feat(warehouse): star schema DDL postgres + snowflake`
- `feat(warehouse): seed 25k deterministic dataset`
- `feat(analytics): 15 analyst SQL queries (window, rank, lag, pareto)`
- Gate: `psql` row counts + query run proof. Push.

### L2 — Streaming + Reconciliation (3-4 commits)
- Port + harden `reconciliationService.js` → 7 rules, variance ₹ calc, idempotency key.
- Kafka producer/consumer (Redpanda) + fallback direct mode if Kafka down.
- `POST /api/settlements/upload`, `POST /api/jobs/reconcile`, `GET /api/kpis/*`
- Gate: reconcile 25k, publish discrepancy events. Push.

### L3 — Python Analytics (3 commits)
- `notebooks/01_eda.ipynb`, `02_hypothesis_tests.ipynb` (t-test, chi-square), `03_forecast.py`
- `scripts/compute_scorecard.py` → courier reliability score
- Gate: notebook outputs PNGs into `/docs/img`. Push.

### L4 — Dashboard + PowerBI (4 commits)
- React: KPI header (₹ leakage, dispute %), trend, pareto, funnel, scorecard table, RCA workbench filters.
- `/powerbi/`: curated exports + `measures.dax` + `build-guide.md`
- Gate: screenshots + demo video script. Push.

### L5 — Case studies + polish (3 commits)
- `/case-studies/`: rca_revenue_drop.md, blinkit_tier2_entry.md, metrics_glossary.md, guesstimate_cod_leakage_india.md
- README final: impact first, architecture second, SQL samples, how to demo in 5 min.
- Resume bullets + interview Q mapping.
- Gate: final tag `v1.0-pa-ready`. Push.

Total: ~17 commits. No squashed mega-commit.

## 5. What we copy from FEA vs rewrite

Copy (reference, not paste):
- 5 rule thresholds: 2%/₹10 COD tolerance, 10% weight, 14-day overdue — `FEA/backend/src/services/reconciliationService.js:7-10,17-72`
- Duplicate check pattern — same file `:78-104`
- Idempotency + backoff idea — `FEA/README.md:222-239`
- CSV upload validation (1000-row limit → raise to 5000) — `FEA/backend/src/routes/settlements.js:17-82`

Rewrite:
- Mongo models → Postgres star schema
- Random seed → deterministic seeded RNG + tiered signals
- Bull/Redis → Kafka/Redpanda (keep Bull as fallback comment, not core)
- webhook.site → internal notification log + optional webhook
- Dashboard counts → ₹ impact + funnel + scorecard

## 6. Interview mapping (why each folder exists)

| Eternal Q | Repo proof |
|---|---|
| 3 hard SQL | `/warehouse/queries/*.sql` with window/rank |
| Python output MCQ + stats | `/python/` pandas + t-test |
| Hotel revenue -7% RCA | `/case-studies/rca_revenue_drop.md` + RCA workbench |
| Blinkit Tier-2 entry | `/case-studies/blinkit_tier2_entry.md` using Tier-2 cost data |
| Rider ranking framework | `courier_scorecard.sql` + `compute_scorecard.py` |
| ETA calculation | `ETA_SLA_BREACH` rule + `eta_sla.sql` |
| Retention/metrics | `metrics_glossary.md` + funnel dashboard |

## 7. Non-goals (to stay serious)

- No real Snowflake account needed. DDL is Snowflake-compatible, runs on Postgres.
- No real Kafka cluster needed. Redpanda single-container locally.
- No PowerBI .pbix binary in git. Ship CSV + DAX + guide (recruiter can rebuild in 10 min).
- No auth/JWT bloat. Document as future work.

---
Approved → proceed L0 → L1 → ... with commit+push after each level.
