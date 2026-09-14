"""07 Export Olist PowerBI tables from MSSQL (both datasets, one DB).

Reads raw_olist_* (dedupes edited reviews like 06) and writes:
  powerbi/dataset/olist_review_impact.csv  (late_flag x sentiment)
  powerbi/dataset/olist_monthly.csv        (trend)
  powerbi/dataset/olist_seller_late.csv    (scorecard analogue)
"""
import pathlib
from db import query

PBI = pathlib.Path(__file__).resolve().parents[2] / "powerbi" / "dataset"
PBI.mkdir(parents=True, exist_ok=True)

DEDUP = """(SELECT *, ROW_NUMBER() OVER (PARTITION BY review_id ORDER BY review_creation_date DESC) rn
            FROM dbo.raw_olist_reviews)"""

# late x sentiment (bad = score<=3, good = >3)
ri = query(f"""SELECT CASE WHEN o.order_delivered_customer_date > o.order_estimated_delivery_date
                             THEN 'Late' ELSE 'On-time' END late_flag,
                    CASE WHEN r.review_score <= 3 THEN 'Bad' ELSE 'Good' END sentiment,
                    COUNT(*) orders_
             FROM dbo.raw_olist_orders o
             JOIN {DEDUP} r ON r.order_id = o.order_id AND r.rn = 1
             WHERE o.order_status = 'delivered'
             GROUP BY CASE WHEN o.order_delivered_customer_date > o.order_estimated_delivery_date
                             THEN 'Late' ELSE 'On-time' END,
                      CASE WHEN r.review_score <= 3 THEN 'Bad' ELSE 'Good' END""")
ri.to_csv(PBI / "olist_review_impact.csv", index=False)
print(ri.to_string(index=False))

# monthly trend
mo = query("""SELECT FORMAT(o.order_purchase_timestamp, 'yyyy-MM') ym,
                    COUNT(*) orders_,
                    SUM(CASE WHEN o.order_delivered_customer_date > o.order_estimated_delivery_date
                             THEN 1 ELSE 0 END) late_orders,
                    AVG(CASE WHEN o.order_delivered_customer_date > o.order_estimated_delivery_date
                             THEN DATEDIFF(DAY, o.order_estimated_delivery_date,
                                                 o.order_delivered_customer_date) END) avg_late_days
              FROM dbo.raw_olist_orders o
              WHERE o.order_status = 'delivered'
              GROUP BY FORMAT(o.order_purchase_timestamp, 'yyyy-MM') ORDER BY ym""")
mo.to_csv(PBI / "olist_monthly.csv", index=False)
print(f"months: {len(mo)}")

# sellers >= 50 orders
se = query("""SELECT i.seller_id, COUNT(*) orders_,
                    AVG(CASE WHEN o.order_delivered_customer_date > o.order_estimated_delivery_date
                             THEN 1.0 ELSE 0.0 END) late_rate
              FROM dbo.raw_olist_items i
              JOIN dbo.raw_olist_orders o ON o.order_id = i.order_id
              WHERE o.order_status = 'delivered'
              GROUP BY i.seller_id HAVING COUNT(*) >= 50 ORDER BY late_rate DESC""")
se.to_csv(PBI / "olist_seller_late.csv", index=False)
print(f"sellers: {len(se)}, worst late-rate {se.late_rate.max():.1%}")
print(f"CSVs -> {PBI}")
