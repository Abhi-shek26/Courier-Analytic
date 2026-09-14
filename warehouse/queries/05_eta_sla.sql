-- 05 ETA + forward-charge SLA (Q13-Q14)
-- Answers: "how would you compute delivery ETA?" + excess charge check

-- Q13: ETA adherence p50/p95 by courier × tier
SELECT c.courier_name, g.tier,
  COUNT(*) AS delivered,
  ROUND(AVG(o.actual_eta_hrs - o.promised_eta_hrs),1) AS avg_delay_hrs,
  PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY o.actual_eta_hrs) AS p50_eta,
  PERCENTILE_CONT(0.95) WITHIN GROUP (ORDER BY o.actual_eta_hrs) AS p95_eta,
  ROUND(100.0*AVG(CASE WHEN o.actual_eta_hrs <= o.promised_eta_hrs THEN 1 ELSE 0 END),1) AS sla_met_pct
FROM fact_orders o
JOIN dim_courier c ON c.courier_id=o.courier_id
JOIN dim_geography g ON g.geo_id=o.geo_id
WHERE o.order_status='DELIVERED' AND o.actual_eta_hrs IS NOT NULL
GROUP BY 1,2 ORDER BY sla_met_pct;

-- Q14: Weight + forward-charge disputes (10% + 15% slab rules)
SELECT o.awb_number, c.courier_name, g.tier,
  o.declared_weight, s.charged_weight,
  ROUND(100.0*(s.charged_weight-o.declared_weight)/NULLIF(o.declared_weight,0),1) AS inflate_pct,
  s.forward_charge
FROM fact_orders o
JOIN fact_settlements s ON s.awb_number=o.awb_number
JOIN dim_courier c ON c.courier_id=o.courier_id
JOIN dim_geography g ON g.geo_id=o.geo_id
WHERE s.charged_weight > o.declared_weight*1.10
ORDER BY inflate_pct DESC LIMIT 100;
