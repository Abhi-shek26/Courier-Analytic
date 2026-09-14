# Case: should a quick-commerce player enter a Tier-2 / Tier-3 city?

Context: expansion decision for a Tier-2/Tier-3 city.
Use `tier_entry.json` + Q16 (`06_segmentation.sql`) as the numbers.

## Framework: demand × margin after logistics × execution risk
1. **Demand:** order density, COD share (cash handling cost), basket value.
2. **Margin after leakage:** GMV − (leakage % of GMV) − last-mile SLA cost.
3. **Execution:** courier reliability in that tier + ETA adherence.

## Numbers from this repo (quote them)
| Tier | Orders | Leakage % of GMV | Avg delay |
|---|---|---|---|
| Tier-1 | 8,410 | ~2.9% | lowest |
| Tier-2 (Indore/Pune proxy) | 8,354 | ~2.4% | mid |
| Tier-3 | 8,236 | ~2.6% | highest (Kwikship ETA breach cluster) |

- Leakage % is flat across tiers → tier expansion is **not** margin-blocked by courier leakage.
- Blocker is SLA: Bluedart Tier-3 weight inflation +12.98% and Kwikship Tier-3 ETA breaches → enter Tier-2 with Shiprocket/Delhivery, hold Tier-3 until renegotiated slab + penalty clause.
- Festival weeks: dispute 36.7% → launch outside peak, pre-staff support.

## Verdict shape
> "Go for Tier-2 (Indore-type): demand density + leakage at 2.4% of GMV + top-courier
> reliability ~70+. Hold Tier-3 until the +13% Tier-3 inflation cell is contracted away —
> that's a 2-point margin swing on COD-heavy assortments."
