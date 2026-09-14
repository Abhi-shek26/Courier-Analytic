# Guesstimate: COD leakage for a city (worked structure)

Prompt style: *"estimate fuel burnt in Mumbai…"* → same method, applied to leakage.

## Question answered here
*How much courier leakage does Indore-type Tier-2 city produce per month?*

## Structure (top-down, state assumptions out loud)
1. Orders/month in city: population 3M × 30% online × 2 orders ≈ **1.8M shipments**.
2. COD share 45% ≈ 810k; avg COD ₹1,800 → COD flow ≈ **₹146 cr**.
3. Dispute rate 23% (repo) → ~415k disputed; avg loss ₹390 (₹22.3L / 5,774) → **≈ ₹16 cr/month leakage**.
4. Sanity: 16/146 ≈ 11% of COD flow at risk — matches overdue+duplicate-heavy mix; round to **₹12–18 cr** range.

## Why this scores
- Segments before multiplying (courier × COD × tier), same habit as the RCA drilldown.
- Anchors on a measured base rate (23.1%) instead of inventing one.
- Ends with a range + sensitivity ("if COD share is 35%, leakage ≈ ₹12 cr").
