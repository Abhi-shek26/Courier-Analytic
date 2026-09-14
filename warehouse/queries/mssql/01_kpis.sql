-- Courier-Analytic MSSQL 01 KPIs (Q1-Q3) — T-SQL, SSMS-ready

-- Q1: Overall leakage + dispute rate (dashboard header)
SELECT
  COUNT(DISTINCT s.awb_number) AS settled_awbs,
  COUNT(DISTINCT d.awb_number) AS disputed_awbs,
  ROUND(100.0 * COUNT(DISTINCT d.awb_number) / NULLIF(COUNT(DISTINCT s.awb_number),0), 2) AS dispute_rate_pct,
  COALESCE(SUM(d.variance_rs),0) AS leakage_rs
FROM dbo.fact_settlements s
LEFT JOIN dbo.fact_discrepancies d ON d.awb_number = s.awb_number AND d.batch_id = s.batch_id;

-- Q2: Daily leakage trend
SELECT s.settlement_date AS kpi_date,
  COUNT(*) AS settlements,
  COUNT(d.awb_number) AS disputes,
  COALESCE(SUM(d.variance_rs),0) AS leakage_rs
FROM dbo.fact_settlements s
LEFT JOIN dbo.fact_discrepancies d ON d.awb_number = s.awb_number AND d.batch_id = s.batch_id
GROUP BY s.settlement_date ORDER BY s.settlement_date;

-- Q3: DSO avg + p50 by courier (DATEDIFF for MSSQL; p50 via PERCENTILE_CONT OVER)
SELECT DISTINCT c.courier_name,
  ROUND(AVG(CAST(DATEDIFF(DAY, o.order_date, s.settlement_date) AS FLOAT)) OVER (PARTITION BY c.courier_name),1) AS avg_dso_days,
  PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY DATEDIFF(DAY, o.order_date, s.settlement_date)) OVER (PARTITION BY c.courier_name) AS p50_dso
FROM dbo.fact_orders o
JOIN dbo.fact_settlements s ON s.awb_number = o.awb_number
JOIN dbo.dim_courier c ON c.courier_id = o.courier_id;
