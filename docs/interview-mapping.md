# Interview mapping — what to open for each Eternal question

| They ask | Open this | Line to say |
|---|---|---|
| OA SQL (window/rank) | `warehouse/queries/mssql/02_courier_scorecard.sql` Q4–Q6 | "RANK, PARTITION BY, running pareto — same patterns as the OA" |
| SQL duplicates/LAG | `04_integrity.sql` Q10, `03_rca_drilldown.sql` Q7 | "ROW_NUMBER dedup + LAG spike detection" |
| Python + stats | `python/scripts/02_hypothesis_tests.py` | "t-test p≈6e-256, chi-square p≈2e-56 — I test before I claim" |
| Hotel revenue −7% RCA | `case-studies/rca_revenue_drop.md` + dashboard RCA workbench | "Slice by segment × week first, then 5 Whys on the top cell" |
| Blinkit Tier-2 entry | `case-studies/blinkit_tier2_entry.md` + `tier_entry.json` | "Leakage flat at 2.4% GMV — SLA is the blocker, not margin" |
| Rider/partner ranking | `courier_scorecard` (SQL Q4 + `03_scorecard.py`) | "0.4 on-time + 0.35 dispute + 0.25 phantom — weights stated upfront" |
| ETA computation | `05_eta_sla.sql` Q13, ETA_SLA_BREACH rule | "p50/p95 by courier × tier, SLA flag at 1.3× promised" |
| Segmentation | `06_segmentation.sql` Q15, `merchants.json` | "GMV quartiles × health bands — same RFM-lite logic" |
| Retention/metrics | `case-studies/metrics_glossary.md` | "North star recoverable ₹; inputs dispute %, DSO, reliability" |
| Guesstimate | `case-studies/guesstimate_cod_leakage.md` | "Segment first, anchor on measured 23.1%, end with range" |
| Project depth | `engine/sql/reconcile.sql` + Kafka verify | "7 set-based rules, idempotent; 6,456 events on the broker" |
| PowerBI | `powerbi/build-guide.md` + `measures.dax` | "4 datasets, 8 measures, 3 pages — reproducible in 10 min" |

## Resume bullets (copy-paste)
1. Built COD settlement analytics on 25k shipments (MSSQL star schema); 7-rule T-SQL engine flagged **₹22.3L leakage across 5,774 AWBs (23.1% dispute rate)** with severity grading.
2. Wrote 16 analyst SQL queries (RANK/PARTITION BY/LAG/ROW_NUMBER/NTILE) + Python validation (Welch t-test p≈6e-256, χ² p≈2e-56) proving Bluedart Tier-3 overcharge and festival-week risk.
3. Shipped Kafka streaming (6,456 events), courier reliability scorecard, React RCA dashboard and PowerBI pack (4 datasets, 8 DAX measures); documented 4 interview case studies (RCA, Tier-2 entry, metrics, guesstimate).
