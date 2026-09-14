-- 03 RCA drilldown: what moved, where, MoM with LAG (Q7-Q9)
-- Pattern: "revenue dropped 7-8%, diagnose" — slice by segment x week first

-- Q7: Week-over-week leakage change (LAG to spot the spike week)
WITH w AS (
  SELECT DATE_TRUNC('week', s.settlement_date)::DATE AS wk,
    COALESCE(SUM(d.variance_rs),0) AS leakage_rs
  FROM fact_settlements s LEFT JOIN fact_discrepancies d
    ON d.awb_number=s.awb_number AND d.batch_id=s.batch_id
  GROUP BY 1
)
SELECT wk, leakage_rs,
  LAG(leakage_rs) OVER (ORDER BY wk) AS prev_wk,
  ROUND(100.0*(leakage_rs - LAG(leakage_rs) OVER (ORDER BY wk))/NULLIF(LAG(leakage_rs) OVER (ORDER BY wk),0),1) AS wow_pct
FROM w ORDER BY wk;

-- Q8: Drilldown — leakage by courier × tier × type (find the cell that explains the drop)
SELECT c.courier_name, g.tier, d.discrepancy_type,
  COUNT(*) AS cases, SUM(d.variance_rs) AS leakage_rs,
  ROUND(AVG(d.variance_rs),0) AS avg_loss
FROM fact_discrepancies d
JOIN dim_courier c ON c.courier_id=d.courier_id
JOIN dim_geography g ON g.geo_id=d.geo_id
GROUP BY 1,2,3 ORDER BY leakage_rs DESC LIMIT 20;

-- Q9: Festival vs normal weeks (was Diwali the cause?)
SELECT CASE WHEN dt.is_festival THEN 'festival' ELSE 'normal' END AS period,
  COUNT(DISTINCT s.awb_number) AS settled,
  COUNT(d.awb_number) AS disputes,
  ROUND(100.0*COUNT(d.awb_number)/NULLIF(COUNT(DISTINCT s.awb_number),0),2) AS dispute_pct,
  COALESCE(SUM(d.variance_rs),0) AS leakage_rs
FROM fact_settlements s
JOIN fact_orders o ON o.awb_number=s.awb_number
JOIN dim_date dt ON dt.date_id=o.order_date
LEFT JOIN fact_discrepancies d ON d.awb_number=s.awb_number AND d.batch_id=s.batch_id
GROUP BY 1;
