# Dashboard (L4) — React product dashboard over static JSON exports

Data: `public/data/*.json` — warehouse JSONs via `python/scripts/05_export_dashboard.py`, Olist monthly/reviews/sellers + forecast exported from `powerbi/dataset/*.csv` + `python/outputs/leakage_forecast.csv`.
No backend needed — deployable to Vercel/Netlify/GitHub Pages for demos.

```bash
cd dashboard
npm install
npm run dev     # http://localhost:5173
npm run build   # static dist/
```

Pages: **Overview** landing (problem, parcel walkthrough, pipeline, 7 rules, stats, both datasets, real-world readiness, cases, PowerBI) → **Analyse** with dataset tabs: Warehouse (trend area, Pareto + cumulative, type/tier donuts, reliability bars, funnel, RCA workbench, merchants) and Olist real-data (monthly orders vs late, review-impact stacked bar, worst-seller bars, settlement analogues).
