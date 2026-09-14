# Metrics glossary (say these exactly in interviews)

## North star
- **Recoverable leakage (₹)** — `SUM(variance_rs)` over `fact_discrepancies`. Currently **₹22,34,719**.

## Input metrics
- **Dispute rate %** — disputed AWBs / settled AWBs. Currently **23.1%**; healthy < 15%.
- **DSO (days sales outstanding)** — `AVG(settlement_date − order_date)`. Currently **5.8**; breach > 14.
- **Courier reliability score** — `100×(0.4×ontime + 0.35×(1−dispute) + 0.25×(1−phantom))`. Shiprocket 72.2 → DTDC 63.7.
- **Recovery rate** — ₹ recovered / ₹ flagged (track post-dispute; engine emits `suggestedAction` per type).
- **False-positive rate** — matched-on-review / flagged. Tolerance `min(2%, ₹10)` and 10% weight band exist to hold this down.
- **Merchant health** — dispute-rate bands (healthy <15%, watchlist <30%, high-risk above) × GMV quartiles (`merchants.json`).
- **Retention (analogy answer)** — for merchants: % still shipping at W+4 after a dispute; disputes are a churn driver, same as delivery-partner quits in Q&A.

## Funnel (dashboard order)
Orders (25,000) → Delivered → Settled (25,000) → Matched (19,226) → Disputed (5,774).
Report ratios between stages, never raw counts alone.
