-- Courier-Analytic MSSQL 06 Segmentation (Q15-Q16)

-- Q15: Merchant value scoring with NTILE
WITH m AS (
  SELECT o.merchant_id, COUNT(*) AS orders,
    SUM(o.order_value) AS gmv, SUM(COALESCE(d.variance_rs,0)) AS leakage_rs,
    CAST(COUNT(d.awb_number) AS FLOAT)/NULLIF(COUNT(*),0) AS dispute_rate
  FROM dbo.fact_orders o LEFT JOIN dbo.fact_discrepancies d ON d.awb_number=o.awb_number
  GROUP BY o.merchant_id
)
SELECT TOP 50 merchant_id, orders, gmv, leakage_rs,
  ROUND(dispute_rate*100,1) AS dispute_pct,
  NTILE(4) OVER (ORDER BY gmv DESC) AS value_quartile,
  CASE WHEN dispute_rate > 0.3 THEN 'high-risk'
       WHEN dispute_rate > 0.15 THEN 'watchlist' ELSE 'healthy' END AS health_band
FROM m ORDER BY gmv DESC;

-- Q16: Tier-2/3 entry math
SELECT g.tier, COUNT(*) AS orders, SUM(o.order_value) AS gmv,
  COALESCE(SUM(d.variance_rs),0) AS leakage_rs,
  ROUND(100.0*COALESCE(SUM(d.variance_rs),0)/NULLIF(SUM(o.order_value),0),2) AS leakage_pct_of_gmv,
  ROUND(AVG(o.actual_eta_hrs - o.promised_eta_hrs),1) AS avg_delay_hrs
FROM dbo.fact_orders o
JOIN dbo.dim_geography g ON g.geo_id=o.geo_id
LEFT JOIN dbo.fact_discrepancies d ON d.awb_number=o.awb_number
GROUP BY g.tier ORDER BY g.tier;
