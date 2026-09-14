-- Courier-Analytic MSSQL 02 Courier scorecard (Q4-Q6)

-- Q4: Reliability score per courier + RANK
WITH base AS (
  SELECT o.courier_id,
    COUNT(*) AS orders,
    AVG(CASE WHEN o.actual_eta_hrs <= o.promised_eta_hrs THEN 1.0 ELSE 0.0 END) AS ontime_rate,
    CAST(COUNT(DISTINCT d.awb_number) AS FLOAT) / NULLIF(COUNT(DISTINCT o.awb_number),0) AS dispute_rate,
    AVG(CASE WHEN d.discrepancy_type=N'PHANTOM_RTO_CHARGE' THEN 1.0 ELSE 0.0 END) AS phantom_rate,
    COALESCE(SUM(d.variance_rs),0) AS leakage_rs
  FROM dbo.fact_orders o
  LEFT JOIN dbo.fact_discrepancies d ON d.awb_number = o.awb_number
  GROUP BY o.courier_id
)
SELECT c.courier_name, b.orders,
  ROUND(b.ontime_rate*100,1) AS ontime_pct,
  ROUND(b.dispute_rate*100,1) AS dispute_pct,
  ROUND((0.4*b.ontime_rate + 0.35*(1-b.dispute_rate) + 0.25*(1-COALESCE(b.phantom_rate,0)))*100,1) AS reliability_score,
  RANK() OVER (ORDER BY (0.4*b.ontime_rate + 0.35*(1-b.dispute_rate) + 0.25*(1-COALESCE(b.phantom_rate,0))) DESC) AS reliability_rank,
  b.leakage_rs
FROM base b JOIN dbo.dim_courier c ON c.courier_id = b.courier_id
ORDER BY reliability_rank;

-- Q5: Worst courier per tier (PARTITION BY)
SELECT tier, courier_name, disputes, leakage_rs,
  RANK() OVER (PARTITION BY tier ORDER BY leakage_rs DESC) AS tier_rank
FROM (
  SELECT g.tier, c.courier_name, COUNT(*) AS disputes, SUM(d.variance_rs) AS leakage_rs
  FROM dbo.fact_discrepancies d
  JOIN dbo.dim_courier c ON c.courier_id = d.courier_id
  JOIN dbo.dim_geography g ON g.geo_id = d.geo_id
  GROUP BY g.tier, c.courier_name
) t ORDER BY tier, tier_rank;

-- Q6: Pareto — running total window
SELECT courier_name, leakage_rs,
  ROUND(100.0*leakage_rs/SUM(leakage_rs) OVER (),1) AS pct_of_total,
  ROUND(100.0*SUM(leakage_rs) OVER (ORDER BY leakage_rs DESC ROWS UNBOUNDED PRECEDING)/SUM(leakage_rs) OVER (),1) AS running_pct
FROM (
  SELECT c.courier_name, SUM(d.variance_rs) AS leakage_rs
  FROM dbo.fact_discrepancies d JOIN dbo.dim_courier c ON c.courier_id=d.courier_id
  GROUP BY c.courier_name
) t ORDER BY leakage_rs DESC;
