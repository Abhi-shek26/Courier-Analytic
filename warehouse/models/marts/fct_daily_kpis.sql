-- dbt-style mart: daily KPIs (staging → marts pattern)
-- Materialized into fct_daily_kpis by engine or scheduled job.
SELECT s.settlement_date AS kpi_date, s.courier_id, o.geo_id,
  COUNT(DISTINCT s.awb_number) AS orders,
  COUNT(DISTINCT d.awb_number) AS disputed_awbs,
  COALESCE(SUM(d.variance_rs),0) AS leakage_rs,
  AVG(s.settlement_date - o.order_date)::NUMERIC(8,2) AS avg_dso_days
FROM fact_settlements s
JOIN fact_orders o ON o.awb_number = s.awb_number
LEFT JOIN fact_discrepancies d ON d.awb_number = s.awb_number AND d.batch_id = s.batch_id
GROUP BY 1,2,3;
