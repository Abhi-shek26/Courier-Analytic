-- Courier-Analytic MSSQL mart: fct_daily_kpis refresh (MERGE pattern for scheduled job)
MERGE dbo.fct_daily_kpis AS t
USING (
  SELECT s.settlement_date AS kpi_date, s.courier_id, o.geo_id,
    COUNT(DISTINCT s.awb_number) AS orders,
    COUNT(DISTINCT d.awb_number) AS disputed_awbs,
    COALESCE(SUM(d.variance_rs),0) AS leakage_rs,
    CAST(AVG(CAST(DATEDIFF(DAY, o.order_date, s.settlement_date) AS FLOAT)) AS DECIMAL(8,2)) AS avg_dso_days
  FROM dbo.fact_settlements s
  JOIN dbo.fact_orders o ON o.awb_number = s.awb_number
  LEFT JOIN dbo.fact_discrepancies d ON d.awb_number = s.awb_number AND d.batch_id = s.batch_id
  GROUP BY s.settlement_date, s.courier_id, o.geo_id
) s ON t.kpi_date=s.kpi_date AND t.courier_id=s.courier_id AND t.geo_id=s.geo_id
WHEN MATCHED THEN UPDATE SET orders=s.orders, disputed_awbs=s.disputed_awbs, leakage_rs=s.leakage_rs, avg_dso_days=s.avg_dso_days
WHEN NOT MATCHED THEN INSERT (kpi_date, courier_id, geo_id, orders, disputed_awbs, leakage_rs, avg_dso_days)
VALUES (s.kpi_date, s.courier_id, s.geo_id, s.orders, s.disputed_awbs, s.leakage_rs, s.avg_dso_days);
