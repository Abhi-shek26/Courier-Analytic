"""01 EDA: leakage structure from live MSSQL. Saves charts to docs/img/."""
import pathlib
import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt
from db import query

IMG = pathlib.Path(__file__).resolve().parents[2] / "docs" / "img"
IMG.mkdir(parents=True, exist_ok=True)

plt.rcParams.update({"figure.dpi": 110, "font.size": 9})

# --- leakage by type ---
t = query("""SELECT discrepancy_type, COUNT(*) cases_, SUM(variance_rs) leakage
             FROM dbo.fact_discrepancies GROUP BY discrepancy_type ORDER BY leakage DESC""")
print(t.to_string(index=False))
ax = t.plot.barh(x="discrepancy_type", y="leakage", legend=False, color="#c53030")
ax.set_xlabel("leakage Rs"); ax.set_ylabel(""); plt.tight_layout()
plt.savefig(IMG / "eda_leakage_by_type.png"); plt.close()

# --- leakage by courier ---
c = query("""SELECT cu.courier_name, SUM(d.variance_rs) leakage, COUNT(*) cases_
             FROM dbo.fact_discrepancies d JOIN dbo.dim_courier cu ON cu.courier_id=d.courier_id
             GROUP BY cu.courier_name ORDER BY leakage DESC""")
print(c.to_string(index=False))
ax = c.plot.bar(x="courier_name", y="leakage", legend=False, color="#2b6cb0")
ax.set_ylabel("leakage Rs"); plt.xticks(rotation=20); plt.tight_layout()
plt.savefig(IMG / "eda_leakage_by_courier.png"); plt.close()

# --- leakage by tier ---
g = query("""SELECT ge.tier, SUM(d.variance_rs) leakage
             FROM dbo.fact_discrepancies d JOIN dbo.dim_geography ge ON ge.geo_id=d.geo_id
             GROUP BY ge.tier ORDER BY ge.tier""")
ax = g.plot.bar(x="tier", y="leakage", legend=False, color="#2f855a")
ax.set_ylabel("leakage Rs"); plt.tight_layout()
plt.savefig(IMG / "eda_leakage_by_tier.png"); plt.close()
print(g.to_string(index=False))

# --- weekly trend ---
w = query("""SELECT DATEADD(WEEK, DATEDIFF(WEEK, 0, s.settlement_date), 0) wk,
                    COALESCE(SUM(d.variance_rs),0) leakage
             FROM dbo.fact_settlements s LEFT JOIN dbo.fact_discrepancies d
               ON d.awb_number=s.awb_number AND d.batch_id=s.batch_id
             GROUP BY DATEADD(WEEK, DATEDIFF(WEEK, 0, s.settlement_date), 0) ORDER BY wk""")
ax = w.plot(x="wk", y="leakage", legend=False, color="#6b46c1")
ax.set_ylabel("weekly leakage Rs"); plt.xticks(rotation=25); plt.tight_layout()
plt.savefig(IMG / "eda_weekly_trend.png"); plt.close()

# --- severity mix ---
s = query("SELECT severity, COUNT(*) n FROM dbo.fact_discrepancies GROUP BY severity")
print(s.to_string(index=False))
print(f"\ncharts -> {IMG}")
