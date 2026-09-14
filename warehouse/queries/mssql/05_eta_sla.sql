-- Courier-Analytic MSSQL 05 ETA + forward charge (Q13-Q14)

-- Q13: ETA adherence by courier x tier (p50/p95 via PERCENTILE_CONT OVER)
SELECT DISTINCT c.courier_name, g.tier,
  COUNT(*) OVER (PARTITION BY c.courier_name, g.tier) AS delivered,
  ROUND(AVG(o.actual_eta_hrs - o.promised_eta_hrs) OVER (PARTITION BY c.courier_name, g.tier),1) AS avg_delay_hrs,
  PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY o.actual_eta_hrs) OVER (PARTITION BY c.courier_name, g.tier) AS p50_eta,
  PERCENTILE_CONT(0.95) WITHIN GROUP (ORDER BY o.actual_eta_hrs) OVER (PARTITION BY c.courier_name, g.tier) AS p95_eta,
  ROUND(100.0*AVG(CASE WHEN o.actual_eta_hrs <= o.promised_eta_hrs THEN 1.0 ELSE 0.0 END) OVER (PARTITION BY c.courier_name, g.tier),1) AS sla_met_pct
FROM dbo.fact_orders o
JOIN dbo.dim_courier c ON c.courier_id=o.courier_id
JOIN dbo.dim_geography g ON g.geo_id=o.geo_id
WHERE o.order_status=N'DELIVERED' AND o.actual_eta_hrs IS NOT NULL;

-- Q14: Weight inflation >10%
SELECT TOP 100 o.awb_number, c.courier_name, g.tier,
  o.declared_weight, s.charged_weight,
  ROUND(100.0*(s.charged_weight-o.declared_weight)/NULLIF(o.declared_weight,0),1) AS inflate_pct,
  s.forward_charge
FROM dbo.fact_orders o
JOIN dbo.fact_settlements s ON s.awb_number=o.awb_number
JOIN dbo.dim_courier c ON c.courier_id=o.courier_id
JOIN dbo.dim_geography g ON g.geo_id=o.geo_id
WHERE s.charged_weight > o.declared_weight*1.10
ORDER BY inflate_pct DESC;
