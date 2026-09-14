# PowerBI build guide — both datasets, interactive report (~25 minutes)

CSVs in `powerbi/dataset/` (all exported from the one MSSQL `CourierAnalytic` DB):
- Warehouse (synthetic 25k): `kpi_daily.csv`, `discrepancies.csv`, `courier_scorecard.csv`, `merchant_health.csv`
- Olist (real 99k): `olist_review_impact.csv`, `olist_monthly.csv`, `olist_seller_late.csv`
- Measures: `measures.dax` (12 measures). Refresh data anytime via
  `python/scripts/05_export_dashboard.py` + `07_export_olist_powerbi.py`.

You need: PowerBI Desktop (free, Windows). Publishing needs a free PowerBI account.

## A. Load (5 min)
1. Get Data → Text/CSV → select all 7 CSVs → Load.
2. Power Query: set types — `kpi_daily[kpi_date]` and `olist_monthly[ym]` to Date
   (`ym` arrives as `yyyy-MM`; add a custom column `month = #date(Number.From(Text.Start([ym],4)), Number.From(Text.End([ym],2)), 1)` and use it on axes).
3. Model view → relationships (single direction). Warehouse tables link on
   `courier_`; Olist tables stay **unrelated** (separate subject — do NOT auto-link):
   - `discrepancies[courier_]` → `courier_scorecard[courier_]` (many-to-one)
   - `kpi_daily[courier_]` → `courier_scorecard[courier_]` (many-to-one)
4. Modeling → New measure → paste all of `measures.dax`.

## B. Page 1 — Overview (warehouse)
- Cards: Total Leakage, Disputed AWBs, Dispute Pct, Avg DSO.
- Line chart: `kpi_date` × Total Leakage. Bar: `courier_` × Total Leakage.
- Donut: `tier` × Total Leakage. Slicer: `severity`.

## C. Page 2 — RCA (warehouse)
- Matrix: rows `courier_` → `tier` → `discrepancy_type`; values Cases (count), Total Leakage.
- Slicers: `tier`, `severity`. Click a matrix cell → everything cross-filters.
- This is the "revenue dropped, where?" screen — demo it first.

## D. Page 3 — Scorecards
- Table `courier_scorecard` sorted by Reliability Score + data bars on Dispute Pct.
- Table `merchant_health` with conditional formatting on `health` (healthy/watchlist/high-risk).

## E. Page 4 — Real-data validation (Olist) ⭐ differentiator
- Cards: Olist Late Rate (8.1%), Bad Review Rate Late (65.3%), On-time (17.2%), Lift in pp (~48).
- 100% stacked bar: `late_flag` × `orders_`, legend `sentiment` — the late-bad-review story in one visual.
- Line: `month` × late_orders (festival/seasonality spikes visible).
- Table: `olist_seller_late` sorted by `late_rate` desc (worst 32.1%).
- Textbox007 Titl on top: "Same rules, real 99k orders — SLA moves CSAT."

## F. Publish + screenshot (5 min)
1. Publish → My Workspace → open in PowerBI Service → File → Embed → publish to web
   (or just copy the Service link).
2. Screenshot Page 1 → save as `docs/img/powerbi_overview.png` (referenced below).
3. Paste the Service link at the top of the repo README next to the dashboard link.

Interaction checklist to try: slicer severity=HIGH → matrix + cards move; click Shiprocket bar → trend + donut filter; Page 4 stacked bar shows 65% vs 17%.
