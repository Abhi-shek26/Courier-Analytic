"""02 Hypothesis tests (alpha=0.05) on live MSSQL data.

T1: Bluedart x Tier-3 weight inflation > rest (one-sided t-test)
T2: Festival weeks dispute-prone (chi-square independence)
T3: Delhivery COD shortfall rate > other couriers (chi-square)
"""
import numpy as np
from scipy import stats
from db import query

print("== T1: Bluedart Tier-3 weight inflation ==")
w = query("""SELECT cu.courier_name, ge.tier, o.declared_weight, s.charged_weight
             FROM dbo.fact_orders o JOIN dbo.fact_settlements s ON s.awb_number=o.awb_number
             JOIN dbo.dim_courier cu ON cu.courier_id=o.courier_id
             JOIN dbo.dim_geography ge ON ge.geo_id=o.geo_id""")
w["inflate"] = (w.charged_weight - w.declared_weight) / w.declared_weight * 100
a = w[(w.courier_name == "Bluedart") & (w.tier == "Tier-3")].inflate
b = w[~((w.courier_name == "Bluedart") & (w.tier == "Tier-3"))].inflate
t, p = stats.ttest_ind(a, b, alternative="greater", equal_var=False)
print(f"  Bluedart T3 mean +{a.mean():.2f}% (n={len(a)}) vs rest +{b.mean():.2f}% (n={len(b)})")
print(f"  Welch t={t:.2f}, p={p:.3e} -> {'REJECT H0: systematic overcharge' if p < 0.05 else 'no signal'}")

print("== T2: festival x dispute independence ==")
f = query("""SELECT dt.is_festival, COUNT(*) n,
                    SUM(CASE WHEN d.awb_number IS NULL THEN 0 ELSE 1 END) disputed
             FROM dbo.fact_orders o JOIN dbo.dim_date dt ON dt.date_id=o.order_date
             LEFT JOIN (SELECT DISTINCT awb_number FROM dbo.fact_discrepancies) d
               ON d.awb_number=o.awb_number
             GROUP BY dt.is_festival""")
print(f.to_string(index=False))
ct = [[r.disputed, r.n - r.disputed] for r in f.itertuples()]
chi2, p, _, _ = stats.chi2_contingency(ct)
print(f"  chi2={chi2:.2f}, p={p:.3e} -> {'REJECT H0: festival weeks riskier' if p < 0.05 else 'no signal'}")

print("== T3: Delhivery COD shortfall vs peers ==")
d = query("""SELECT CASE WHEN cu.courier_name='Delhivery' THEN 'Delhivery' ELSE 'peer' END grp,
                    COUNT(*) n,
                    SUM(CASE WHEN x.awb_number IS NULL THEN 0 ELSE 1 END) short
             FROM dbo.fact_orders o JOIN dbo.dim_courier cu ON cu.courier_id=o.courier_id
             LEFT JOIN (SELECT DISTINCT awb_number FROM dbo.fact_discrepancies
                        WHERE discrepancy_type='COD_SHORT_REMITTANCE') x ON x.awb_number=o.awb_number
             WHERE o.cod_amount > 0 GROUP BY CASE WHEN cu.courier_name='Delhivery' THEN 'Delhivery' ELSE 'peer' END""")
print(d.to_string(index=False))
ct = [[r.short, r.n - r.short] for r in d.itertuples()]
chi2, p, _, _ = stats.chi2_contingency(ct)
print(f"  chi2={chi2:.2f}, p={p:.3e} -> {'REJECT H0: Delhivery COD worse' if p < 0.05 else 'no signal'}")
