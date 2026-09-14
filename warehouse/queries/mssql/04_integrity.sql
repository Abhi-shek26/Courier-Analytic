-- Courier-Analytic MSSQL 04 Integrity (Q10-Q12)

-- Q10: Duplicate AWBs (ROW_NUMBER + COUNT OVER)
SELECT awb_number, batch_id, courier_name, settlement_date
FROM (
  SELECT s.awb_number, s.batch_id, c.courier_name, s.settlement_date,
    ROW_NUMBER() OVER (PARTITION BY s.awb_number ORDER BY s.settlement_date) AS rn,
    COUNT(*) OVER (PARTITION BY s.awb_number) AS cnt
  FROM dbo.fact_settlements s JOIN dbo.dim_courier c ON c.courier_id=s.courier_id
) t WHERE cnt > 1 ORDER BY awb_number, settlement_date;

-- Q11: Overdue >14d via DATEDIFF
SELECT TOP 100 s.awb_number, c.courier_name, o.order_date, s.settlement_date,
  DATEDIFF(DAY, o.order_date, s.settlement_date) AS dso_days, s.settled_cod
FROM dbo.fact_settlements s
JOIN dbo.fact_orders o ON o.awb_number=s.awb_number
JOIN dbo.dim_courier c ON c.courier_id=s.courier_id
WHERE DATEDIFF(DAY, o.order_date, s.settlement_date) > 14
ORDER BY dso_days DESC;

-- Q12: COD short-remittance, tolerance CASE instead of LEAST (2019-compatible)
SELECT TOP 100 o.awb_number, c.courier_name, o.cod_amount AS expected_cod, s.settled_cod AS actual_cod,
  (o.cod_amount - s.settled_cod) AS shortfall_rs
FROM dbo.fact_orders o
JOIN dbo.fact_settlements s ON s.awb_number=o.awb_number
JOIN dbo.dim_courier c ON c.courier_id=o.courier_id
WHERE o.cod_amount > 0
  AND s.settled_cod < o.cod_amount - CASE WHEN o.cod_amount*0.02 < 10 THEN o.cod_amount*0.02 ELSE 10 END
ORDER BY shortfall_rs DESC;
