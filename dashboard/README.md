# Dashboard (L4) — React product dashboard over static JSON exports

Data: `public/data/*.json` generated from MSSQL via `python/scripts/05_export_dashboard.py`.
No backend needed — deployable to Vercel/Netlify/GitHub Pages for interviews.

```bash
cd dashboard
npm install
npm run dev     # http://localhost:5173
npm run build   # static dist/
```

Pages in one view: KPI header (₹ leakage, dispute %, DSO) → weekly trend →
Pareto by courier → funnel + Tier entry math → courier reliability scorecard →
**RCA workbench** (courier × tier filters + auto 5-Why read) → merchant health.
