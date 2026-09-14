-- Courier-Analytic MSSQL 03 RCA drilldown (Q7-Q9)

-- Q7: Week-over-week leakage with LAG
WITH w AS (
  SELECT DATEADD(WEEK, DATEDIFF(WEEK, 0, s.settlement_date), 0) AS wk,
    COALESCE(SUM(d.variance_rs),0) AS leakage_rs
  FROM dbo.fact_settlements s LEFT JOIN dbo.fact_discrepancies d
    ON d.awb_number=s.awb_number AND d.batch_id=s.batch_id
  GROUP BY DATEADD(WEEK, DATEDIFF(WEEK, 0, s.settlement_date), 0)
)
SELECT wk, leakage_rs,
  LAG(leakage_rs) OVER (ORDER BY wk) AS prev_wk,
  ROUND(100.0*(leakage_rs - LAG(leakage_rs) OVER (ORDER BY wk))/NULLIF(LAG(leakage_rs) OVER (ORDER BY wk),0),1) AS wow_pct
FROM w ORDER BY wk;

-- Q8: Drilldown courier x tier x type (TOP instead of LIMIT)
SELECT TOP 20 c.courier_name, g.tier, d.discrepancy_type,
  COUNT(*) AS cases, SUM(d.variance_rs) AS leakage_rs,
  ROUND(AVG(d.variance_rs),0) AS avg_loss
FROM dbo.fact_discrepancies d
JOIN dbo.dim_courier c ON c.courier_id=d.courier_id
JOIN dbo.dim_geography g ON g.geo_id=d.geo_id
GROUP BY c.courier_name, g.tier, d.discrepancy_type ORDER BY leakage_rs DESC;

-- Q9: Festival vs normal (BIT flag)
SELECT CASE WHEN dt.is_festival=1 THEN 'festival' ELSE 'normal' END AS period,
  COUNT(DISTINCT s.awb_number) AS settled,
  COUNT(d.awb_number) AS disputes,
  ROUND(100.0*COUNT(d.awb_number)/NULLIF(COUNT(DISTINCT s.awb_number),0),2) AS dispute_pct,
  COALESCE(SUM(d.variance_rs),0) AS leakage_rs
FROM dbo.fact_settlements s
JOIN dbo.fact_orders o ON o.awb_number=s.awb_number
JOIN dbo.dim_date dt ON dt.date_id=o.order_date
LEFT JOIN dbo.fact_discrepancies d ON d.awb_number=s.awb_number AND d.batch_id=s.batch_id
GROUP BY CASE WHEN dt.is_festival=1 THEN 'festival' ELSE 'normal' END;
