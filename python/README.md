# Python analytics (L3) — EDA + stats + scorecard + forecast

Reads live from `CourierAnalytic` MSSQL (Windows auth). Data is **synthetic with
injected RCA signals** (Bluedart Tier-3 inflation, festival overdue spike,
Delhivery COD shortfall) — the tests below are designed to catch exactly those.

```bash
pip install -r requirements.txt
python scripts/01_eda.py
python scripts/02_hypothesis_tests.py
python scripts/03_scorecard.py
python scripts/04_forecast.py
```

## Findings on 25k seed (2026-09-14)
- Leakage **₹22.3L** across 5,774 AWBs; top cell: duplicate settlements ₹9.1L, then overdue ₹7.7L.
- **T1** Bluedart Tier-3 weight inflation **+12.98%** vs +0.00% rest (Welch t=41.2, p≈6e-256) → systematic overcharge, raise dispute.
- **T2** Festival weeks dispute rate **36.7%** vs 21.8% normal (χ²=250, p≈2e-56) → capacity/process RCA.
- **T3** Delhivery COD shortfall concentrated on high-value COD (χ²=3063, p≈0) → hold high-value COD, follow up.
- **Scorecard:** Shiprocket most reliable (72.2) despite highest leakage (volume-driven); DTDC last (63.7). See `outputs/courier_scorecard.csv`.
- **Forecast:** Ridge(t, festival) R²=0.32; leakage trending +₹7k/week. See `outputs/leakage_forecast.csv`.

Charts: `docs/img/eda_*` + `forecast.png`. These feed L4 dashboard + PowerBI.

## Real-data validation — Olist (99,441 Brazilian e-commerce orders)
`scripts/06_olist_validation.py` ports the engine onto Kaggle's `olistbr/brazilian-ecommerce`:
- Late delivery (ETA-breach analogue): **8.1%**, avg **9.6 days** late.
- Payment-vs-bill mismatches (settlement analogue): 249 orders (0.25%).
- Freight outliers (excess-charge analogue): 983 orders where freight > 146% of price.
- **Late → 65.3% bad reviews vs 17.2% on-time** (χ²=9833, p≈0) — delivery SLA directly moves CSAT.
- 462 sellers scored, worst at 32.1% late (scorecard analogue).
- See `outputs/olist_validation.json` + `docs/img/olist_late_vs_reviews.png`.
- Raw tables also loaded in MSSQL: `raw_olist_orders/items/payments/reviews`
  (`warehouse/ddl/mssql/raw_olist.sql` + `warehouse/seed/load_olist_mssql.py`) —
  both datasets query side-by-side in `CourierAnalytic`.
