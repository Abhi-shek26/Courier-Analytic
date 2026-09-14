-- 04 Integrity: duplicates + overdue with ROW_NUMBER (Q10-Q12)

-- Q10: Duplicate AWBs across batches (ROW_NUMBER — classic OA pattern)
SELECT awb_number, batch_id, courier_name, settlement_date
FROM (
  SELECT s.awb_number, s.batch_id, c.courier_name, s.settlement_date,
    ROW_NUMBER() OVER (PARTITION BY s.awb_number ORDER BY s.settlement_date) AS rn,
    COUNT(*) OVER (PARTITION BY s.awb_number) AS cnt
  FROM fact_settlements s JOIN dim_courier c ON c.courier_id=s.courier_id
) t WHERE cnt > 1 ORDER BY awb_number, settlement_date;

-- Q11: Overdue remittance >14d (DSO breach list for follow-up)
SELECT s.awb_number, c.courier_name, o.order_date, s.settlement_date,
  (s.settlement_date - o.order_date) AS dso_days, s.settled_cod
FROM fact_settlements s
JOIN fact_orders o ON o.awb_number=s.awb_number
JOIN dim_courier c ON c.courier_id=s.courier_id
WHERE (s.settlement_date - o.order_date) > 14
ORDER BY dso_days DESC LIMIT 100;

-- Q12: COD short-remittance list with tolerance min(2%, ₹10) (FEA rule in SQL)
SELECT o.awb_number, c.courier_name, o.cod_amount AS expected_cod, s.settled_cod AS actual_cod,
  (o.cod_amount - s.settled_cod) AS shortfall_rs
FROM fact_orders o
JOIN fact_settlements s ON s.awb_number=o.awb_number
JOIN dim_courier c ON c.courier_id=o.courier_id
WHERE o.cod_amount > 0
  AND s.settled_cod < o.cod_amount - LEAST(o.cod_amount*0.02, 10)
ORDER BY shortfall_rs DESC LIMIT 100;
