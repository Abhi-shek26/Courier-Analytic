# PowerBI build guide (10 minutes)

Dataset CSVs in `powerbi/dataset/` (exported from MSSQL via `python/scripts/05_export_dashboard.py`):
`kpi_daily.csv`, `discrepancies.csv`, `courier_scorecard.csv`, `merchant_health.csv`.

## Steps
1. PowerBI Desktop → Get Data → Text/CSV → load the 4 files.
2. Model view → relationships (all single-direction):
   - `discrepancies[courier_]` → `courier_scorecard[courier_]` (many-to-one)
   - `kpi_daily[courier_]` → `courier_scorecard[courier_]` (many-to-one)
   - `kpi_daily[kpi_date]` date table: mark as date table.
3. Paste measures from `measures.dax` (Modeling → New measure).
4. Pages:
   - **Overview:** Cards (Total Leakage, Disputed AWBs, Dispute Pct, Avg DSO) + line (leakage by kpi_date) + bar (leakage by courier) + donut (by tier).
   - **RCA:** Matrix courier × tier × discrepancy_type (values: cases, leakage) + slicers on tier/severity. This answers "revenue dropped 7-8%, where?".
   - **Courier scorecard:** Table sorted by reliability + conditional formatting on Dispute Pct.
   - **Merchant health:** Table with health band + Q1-Q4 value quartile.
5. Publish to PowerBI Service → share link in README + resume.

Screenshot the Overview page → save as `docs/img/powerbi_overview.png`.
