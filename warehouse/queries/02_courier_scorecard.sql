-- 02 Courier scorecard: RANK + window fns (Q4-Q6)
-- Direct answer to: "rank delivery partners by reliability"

-- Q4: Reliability score per courier (0-100): on-time × (1-dispute) × (1-phantom)
WITH base AS (
  SELECT o.courier_id,
    COUNT(*) AS orders,
    AVG(CASE WHEN o.actual_eta_hrs <= o.promised_eta_hrs THEN 1.0 ELSE 0.0 END) AS ontime_rate,
    COUNT(DISTINCT d.awb_number)::FLOAT / NULLIF(COUNT(DISTINCT o.awb_number),0) AS dispute_rate,
    AVG(CASE WHEN d.discrepancy_type='PHANTOM_RTO_CHARGE' THEN 1.0 ELSE 0.0 END) AS phantom_rate,
    COALESCE(SUM(d.variance_rs),0) AS leakage_rs
  FROM fact_orders o
  LEFT JOIN fact_discrepancies d ON d.awb_number = o.awb_number
  GROUP BY 1
)
SELECT c.courier_name, b.orders,
  ROUND(b.ontime_rate*100,1) AS ontime_pct,
  ROUND(b.dispute_rate*100,1) AS dispute_pct,
  ROUND((0.4*b.ontime_rate + 0.35*(1-b.dispute_rate) + 0.25*(1-COALESCE(b.phantom_rate,0)))*100,1) AS reliability_score,
  RANK() OVER (ORDER BY (0.4*b.ontime_rate + 0.35*(1-b.dispute_rate) + 0.25*(1-COALESCE(b.phantom_rate,0))) DESC) AS reliability_rank,
  b.leakage_rs
FROM base b JOIN dim_courier c ON c.courier_id = b.courier_id
ORDER BY reliability_rank;

-- Q5: Worst courier per tier (PARTITION BY — OA favourite)
SELECT tier, courier_name, disputes, leakage_rs,
  RANK() OVER (PARTITION BY tier ORDER BY leakage_rs DESC) AS tier_rank
FROM (
  SELECT g.tier, c.courier_name, COUNT(*) AS disputes, SUM(d.variance_rs) AS leakage_rs
  FROM fact_discrepancies d
  JOIN dim_courier c ON c.courier_id = d.courier_id
  JOIN dim_geography g ON g.geo_id = d.geo_id
  GROUP BY 1,2
) t ORDER BY tier, tier_rank;

-- Q6: Pareto — which couriers = 80% leakage (running total window)
SELECT courier_name, leakage_rs,
  ROUND(100.0*leakage_rs/SUM(leakage_rs) OVER (),1) AS pct_of_total,
  ROUND(100.0*SUM(leakage_rs) OVER (ORDER BY leakage_rs DESC ROWS UNBOUNDED PRECEDING)/SUM(leakage_rs) OVER (),1) AS running_pct
FROM (
  SELECT c.courier_name, SUM(d.variance_rs) AS leakage_rs
  FROM fact_discrepancies d JOIN dim_courier c ON c.courier_id=d.courier_id
  GROUP BY 1
) t ORDER BY leakage_rs DESC;
