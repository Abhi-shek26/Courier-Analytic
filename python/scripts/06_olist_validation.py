"""06 Olist validation: port Courier-Analytic rules onto 99k REAL orders.

Dataset: olistbr/brazilian-ecommerce (Kaggle, cached via kagglehub).
Engine concept -> Olist reality:
  ETA_SLA_BREACH   -> delivered_customer_date > estimated_delivery_date (late)
  COD_SHORT analogue-> payments sum vs items (price+freight) sum mismatch
  EXCESS_FORWARD   -> freight outliers (freight/price ratio top 1%)
  Scorecard        -> seller late-rate ranking (courier scorecard analogue)
  Hypothesis test  -> late delivery drives low reviews (chi-square, REAL finding)

Saves python/outputs/olist_validation.json + docs/img/olist_late_vs_reviews.png
"""
import json
import pathlib
import kagglehub
import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt
import pandas as pd
from scipy import stats

D = pathlib.Path(kagglehub.dataset_download("olistbr/brazilian-ecommerce"))
OUT = pathlib.Path(__file__).parent.parent / "outputs"
IMG = pathlib.Path(__file__).resolve().parents[2] / "docs" / "img"
OUT.mkdir(exist_ok=True)

orders = pd.read_csv(D / "olist_orders_dataset.csv",
                     parse_dates=["order_purchase_timestamp", "order_delivered_customer_date",
                                  "order_estimated_delivery_date"])
items = pd.read_csv(D / "olist_order_items_dataset.csv")
pay = pd.read_csv(D / "olist_order_payments_dataset.csv")
rev = pd.read_csv(D / "olist_order_reviews_dataset.csv")
print(f"orders={len(orders)} delivered={(orders.order_status=='delivered').sum()}")

# --- Rule port 1: late delivery (ETA_SLA_BREACH analogue) ---
dlv = orders[orders.order_status == "delivered"].copy()
dlv["late_days"] = (dlv.order_delivered_customer_date - dlv.order_estimated_delivery_date).dt.days
dlv["late"] = dlv.late_days > 0
late_rate = dlv.late.mean()
print(f"late deliveries: {dlv.late.sum()} / {len(dlv)} = {late_rate:.1%}, avg late {dlv[dlv.late].late_days.mean():.1f} days")

# --- Rule port 2: paid vs price+freight mismatch (settlement analogue) ---
bill = items.groupby("order_id")[["price", "freight_value"]].sum()
paid = pay.groupby("order_id")["payment_value"].sum()
m = bill.join(paid, how="inner")
m["diff"] = (m.payment_value - m.price - m.freight_value).round(2)
mis = m[m["diff"].abs() > 1.0]
print(f"payment mismatches >R$1: {len(mis)} / {len(m)} = {len(mis)/len(m):.2%}, value at stake R$ {mis['diff'].abs().sum():,.0f}")

# --- Rule port 3: freight outliers (EXCESS_FORWARD analogue) ---
m["fr_ratio"] = m.freight_value / m.price.replace(0, float("nan"))
cut = m.fr_ratio.quantile(0.99)
out = m[m.fr_ratio > cut]
print(f"freight outliers (ratio>{cut:.2f}): {len(out)} orders, avg freight share {out.fr_ratio.mean():.1%}")

# --- Real hypothesis test: lateness -> bad reviews ---
r = rev.sort_values("review_creation_date").drop_duplicates("order_id")
j = dlv[["order_id", "late"]].merge(r[["order_id", "review_score"]], on="order_id")
j["bad"] = j.review_score <= 3
ct = pd.crosstab(j.late, j.bad)
chi2, p, _, _ = stats.chi2_contingency(ct)
print(f"bad-review rate: late {j[j.late].bad.mean():.1%} vs on-time {j[~j.late].bad.mean():.1%} "
      f"(chi2={chi2:.0f}, p={p:.2e})")

# --- Seller scorecard analogue ---
s = items.merge(dlv[["order_id", "late"]], on="order_id").groupby("seller_id")["late"].agg(["mean", "count"])
s = s[s["count"] >= 50].sort_values("mean", ascending=False)
print(f"sellers >=50 orders: {len(s)}, worst late-rate {s.iloc[0]['mean']:.1%} (n={s.iloc[0]['count']:.0f})")

fig, ax = plt.subplots()
pd.crosstab(j.late, j.bad, normalize="index").plot.bar(ax=ax, color=["#2f855a", "#c53030"])
ax.set_xticklabels(["on-time", "late"], rotation=0)
ax.set_ylabel("share"); ax.legend(["good review", "bad review"]); plt.tight_layout()
plt.savefig(IMG / "olist_late_vs_reviews.png"); plt.close()

res = {"orders": len(orders), "late_rate": round(float(late_rate), 4),
       "late_n": int(dlv.late.sum()), "mismatch_rate": round(len(mis) / len(m), 4),
       "mismatch_value_brl": round(float(mis["diff"].abs().sum()), 0),
       "freight_outliers": int(len(out)),
       "bad_review_late": round(float(j[j.late].bad.mean()), 4),
       "bad_review_ontime": round(float(j[~j.late].bad.mean()), 4),
       "chi2_p": float(p), "sellers_scored": int(len(s)),
       "worst_seller_late_rate": round(float(s.iloc[0]["mean"]), 4)}
(OUT / "olist_validation.json").write_text(json.dumps(res, indent=1))
print("saved outputs/olist_validation.json + olist_late_vs_reviews.png")
