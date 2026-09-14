# Courier-Analytic — explained from zero

## The real-world problem

You order shoes worth ₹2,000 Cash on Delivery. The delivery agent collects ₹2,000
from you and hands it to the courier company (Delhivery, Bluedart…). Later, the
courier is supposed to **settle** — transfer that ₹2,000 to the shopkeeper, minus
delivery charges.

A shopkeeper shipping 25,000 parcels a month through 5 couriers receives a big
CSV file from each courier: "here's what we delivered and here's the money."
Someone must check: *did I get the right money for every parcel?*

Nobody checks properly. Money leaks:
- Courier collected ₹2,000 but transferred ₹1,850 (COD shortfall)
- Courier billed 2.5 kg on a 2 kg parcel (weight dispute)
- Order delivered, yet a "return" fee charged (phantom RTO)
- Money arrives 25 days late instead of 7 (overdue — cash stuck)
- Same parcel settled twice (duplicate)

**This project is the shopkeeper's watchdog.** It compares courier settlement
files against the shop's own order records, catches every mismatch, prices it
in rupees, and shows *where* the money leaks.

## One parcel, walked through

Shop record: `AWB100001, COD ₹5,000, weight 2 kg, status DELIVERED`
Courier file: `AWB100001, transferred ₹4,600, charged 2.5 kg, RTO fee ₹150`

Verdict: COD short ₹400 + weight inflated 25% + phantom RTO ₹150.
Scale that to thousands of parcels → **₹22.3 lakh across 5,774 parcels.**

## What each piece does

**MSSQL database (the warehouse).** 8 tidy tables: couriers, cities/tiers,
merchants, dates, all orders, all settlements, every mismatch found, daily KPIs.
Structured so "which courier cheats most in Tier-3?" is one query.

**Reconciliation engine (7 rules).** A stored procedure — a saved, repeatable
checklist inside the database. Scans all settlements, applies 7 yes/no tests
(COD short, weight, phantom RTO, overdue, duplicate, ETA breach, excess freight),
attaching rupee loss + severity (HIGH/MEDIUM/LOW). Idempotent: safe to re-run.

**Kafka / Redpanda (the conveyor belt).** Each mismatch becomes a message
("AWB100001, COD_SHORT, ₹400") on a topic. Other systems — SMS alerts, dispute
tools, finance ledger — can consume independently without slowing the engine.
Redpanda is a laptop-friendly Kafka that runs via Docker.

**Python analytics (the detective).** Statistics, not gut feel: Welch t-test
proves Bluedart Tier-3 inflation (+12.98%, p≈6e-256); chi-square proves festival
weeks riskier (36.7% vs 21.8%, p≈2e-56); a weighted scorecard ranks couriers;
a Ridge model forecasts next month's leakage (+₹7k/week trend).

**Dashboard + PowerBI (the screen).** React dashboard: headline KPIs, trend,
Pareto, funnel, reliability scorecard, and an RCA workbench (pick courier ×
tier → worst cell explained in plain words). PowerBI pack: 4 ready CSVs +
8 DAX measures + 10-minute setup guide for manager audiences.

## Would it run on real-world data?

~80% transfers directly: schema, rules, queries, statistics, dashboard, Kafka
pattern. Point it at real courier CSVs with the same columns and it runs.
The remaining 20% to harden: automatic daily fetching from courier portals/APIs,
real per-courier rate cards (the ₹60/kg proxy is a placeholder), logins/audit
trail, managed Kafka, and a dispute-recovery loop (filing claims, tracking money
recovered). See `case-studies/` for worked analyses on this data.
