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

Load to Postgres:
```sql
\copy dim_courier FROM 'output/dim_courier.csv' CSV HEADER;
\copy dim_geography FROM 'output/dim_geography.csv' CSV HEADER;
\copy dim_merchant FROM 'output/dim_merchant.csv' CSV HEADER;
\copy fact_orders FROM 'output/fact_orders.csv' CSV HEADER;
\copy fact_settlements FROM 'output/fact_settlements.csv' CSV HEADER;
```
