# Warehouse seed

Deterministic generator (seed=42). No DB needed to generate.

```bash
cd warehouse/seed
npm install   # no deps, node 20+ only
npm run generate
```

Outputs to `./output/` (git-ignored, sample committed separately):
- `dim_courier.csv`, `dim_geography.csv`, `dim_merchant.csv`
- `fact_orders.csv` (25k), `fact_settlements.csv` (~25.25k incl. 1% dups)
- `_stats.json`

Load to MS SQL Server (local, Windows auth):
```bash
pip install pyodbc
python load_mssql.py --dir ./output
# → 25,000 orders / ~25,275 settlements / 90 dim_dates
# verified 2026-09-14 on SQL Server 2025
```

Legacy BULK INSERT script: `../ddl/mssql/load_sample.sql` (needs service-account path access).
