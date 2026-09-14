-- 01 KPIs: leakage, dispute rate, DSO (Q1-Q3)
-- Runs on Postgres + Snowflake.

-- Q1: Overall leakage + dispute rate (single pane for dashboard header)
SELECT
  COUNT(DISTINCT s.awb_number) AS settled_awbs,
  COUNT(DISTINCT d.awb_number) AS disputed_awbs,
  ROUND(100.0 * COUNT(DISTINCT d.awb_number) / NULLIF(COUNT(DISTINCT s.awb_number),0), 2) AS dispute_rate_pct,
  COALESCE(SUM(d.variance_rs),0) AS leakage_rs
FROM fact_settlements s
LEFT JOIN fact_discrepancies d ON d.awb_number = s.awb_number AND d.batch_id = s.batch_id;

-- Q2: Daily leakage trend (for trend chart + MoM)
SELECT s.settlement_date AS kpi_date,
  COUNT(*) AS settlements,
  COUNT(d.awb_number) AS disputes,
  COALESCE(SUM(d.variance_rs),0) AS leakage_rs
FROM fact_settlements s
LEFT JOIN fact_discrepancies d ON d.awb_number = s.awb_number AND d.batch_id = s.batch_id
GROUP BY 1 ORDER BY 1;

-- Q3: DSO — avg days order→settlement by courier (cash-flow metric PAs must know)
SELECT c.courier_name,
  ROUND(AVG(s.settlement_date - o.order_date),1) AS avg_dso_days,
  PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY (s.settlement_date - o.order_date)) AS p50_dso
FROM fact_orders o
JOIN fact_settlements s ON s.awb_number = o.awb_number
JOIN dim_courier c ON c.courier_id = o.courier_id
GROUP BY 1 ORDER BY avg_dso_days DESC;
