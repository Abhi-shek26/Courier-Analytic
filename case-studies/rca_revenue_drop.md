# Case: revenue dropped 7–8% — RCA method

Context: revenue of a regional operation is declining 7–8%. Diagnose.
Framework below is logistics-flavoured but transfers 1:1 (replace courier→property, AWB→booking).

## Framework (state it in the first 60 seconds)
1. **Slice the drop:** real vs nominal, segment (courier × tier × week), cohort (new vs repeat merchants).
2. **Funnel check:** orders → delivered → settled → matched. Where does the ratio break?
3. **5 Whys on the top cell**, validated by a query + a test, not opinion.

## Worked example on this repo's data
- Q7 (`03_rca_drilldown.sql`): WoW leakage with `LAG()` flags the festival week spike (+₹1.08L coefficient in forecast model).
- Q8 drilldown: top cell **Shiprocket × Tier-1 × OVERDUE** — 437 overdue cases, **₹7.7L cash stuck**, DSO p50 blown out.
- Second cell: **duplicate settlements ₹9.1L** — same AWB paid twice across batches (275 AWBs).
- T2 χ² test (`02_hypothesis_tests.py`): festival dispute 36.7% vs 21.8%, p≈2e-56 → process failure under load, not pricing.

## Recommendation shape
- Now: hold high-value COD with Delhivery, auto-hold duplicate AWBs at ingestion (idempotency key already in engine).
- Next: festival SLA buffer + courier penalty clause for Bluedart Tier-3 (+12.98% inflation, p≈6e-256).
- Metric to watch: dispute % back under 15% and DSO under 7 days within 4 weeks.

## Notes
> "Don't start with causes. Slice the 7% by segment and week first — in this
> project the same method isolated a festival-week overdue spike worth ₹7.7L in one query."
