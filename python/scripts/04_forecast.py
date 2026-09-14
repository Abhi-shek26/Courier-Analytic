"""04 Weekly leakage forecast: Ridge(time_idx, festival_flag) -> next 4 weeks.

Saves python/outputs/leakage_forecast.csv + docs/img/forecast.png
"""
import pathlib
import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt
import numpy as np
import pandas as pd
from sklearn.linear_model import Ridge
from db import query

OUT = pathlib.Path(__file__).parent.parent / "outputs"
OUT.mkdir(exist_ok=True)
IMG = pathlib.Path(__file__).resolve().parents[2] / "docs" / "img"

w = query("""SELECT DATEADD(WEEK, DATEDIFF(WEEK, 0, s.settlement_date), 0) wk,
                    COALESCE(SUM(d.variance_rs),0) leakage,
                    MAX(CAST(dt.is_festival AS INT)) fest
             FROM dbo.fact_settlements s
             LEFT JOIN dbo.fact_discrepancies d ON d.awb_number=s.awb_number AND d.batch_id=s.batch_id
             LEFT JOIN dbo.fact_orders o ON o.awb_number=s.awb_number
             LEFT JOIN dbo.dim_date dt ON dt.date_id=o.order_date
             GROUP BY DATEADD(WEEK, DATEDIFF(WEEK, 0, s.settlement_date), 0) ORDER BY wk""")
w["t"] = np.arange(len(w))
model = Ridge().fit(w[["t", "fest"]], w.leakage)
print(f"train R^2 = {model.score(w[['t','fest']], w.leakage):.3f} (coef t={model.coef_[0]:.0f}, fest={model.coef_[1]:.0f})")

last = w.wk.max()
future = pd.DataFrame({
    "wk": [last + pd.Timedelta(weeks=i) for i in range(1, 5)],
    "t": [len(w) + i - 1 for i in range(1, 5)],
    "fest": [0, 0, 0, 0],
    "forecast": True,
})
future["leakage"] = model.predict(future[["t", "fest"]]).round(0)
w["forecast"] = False
all_ = pd.concat([w[["wk", "leakage", "forecast"]], future[["wk", "leakage", "forecast"]]])
future[["wk", "leakage"]].to_csv(OUT / "leakage_forecast.csv", index=False)
print(future[["wk", "leakage"]].to_string(index=False))

fig, ax = plt.subplots()
ax.plot(w.wk, w.leakage, label="actual", color="#2b6cb0")
ax.plot(future.wk, future.leakage, "--o", label="forecast", color="#c53030")
ax.legend(); ax.set_ylabel("weekly leakage Rs"); plt.xticks(rotation=25); plt.tight_layout()
plt.savefig(IMG / "forecast.png"); plt.close()
print(f"saved -> {OUT / 'leakage_forecast.csv'} + forecast.png")
