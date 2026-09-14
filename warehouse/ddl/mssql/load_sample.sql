-- Courier-Analytic MSSQL load (SSMS, database CourierAnalytic)
-- CSVs from warehouse/seed/output/ (or output_sample/ for 500-row trial)
-- 1) Create schema first: :r .\schema.sql
-- 2) Update paths below to your local output folder, then run.

-- BULK INSERT needs paths readable by the SQL Server service account.
-- Alternative for local dev: use SSMS Import Flat File wizard with same column order.

BULK INSERT dbo.dim_courier FROM 'C:\Users\HELLO\Desktop\Codings\Courier-Analytic\warehouse\seed\output\dim_courier.csv'
WITH (FIRSTROW=2, FIELDTERMINATOR=',', ROWTERMINATOR='0x0a', TABLOCK);

BULK INSERT dbo.dim_geography FROM 'C:\Users\HELLO\Desktop\Codings\Courier-Analytic\warehouse\seed\output\dim_geography.csv'
WITH (FIRSTROW=2, FIELDTERMINATOR=',', ROWTERMINATOR='0x0a', TABLOCK);

BULK INSERT dbo.dim_merchant FROM 'C:\Users\HELLO\Desktop\Codings\Courier-Analytic\warehouse\seed\output\dim_merchant.csv'
WITH (FIRSTROW=2, FIELDTERMINATOR=',', ROWTERMINATOR='0x0a', TABLOCK);

BULK INSERT dbo.fact_orders FROM 'C:\Users\HELLO\Desktop\Codings\Courier-Analytic\warehouse\seed\output\fact_orders.csv'
WITH (FIRSTROW=2, FIELDTERMINATOR=',', ROWTERMINATOR='0x0a', TABLOCK);

BULK INSERT dbo.fact_settlements FROM 'C:\Users\HELLO\Desktop\Codings\Courier-Analytic\warehouse\seed\output\fact_settlements.csv'
WITH (FIRSTROW=2, FIELDTERMINATOR=',', ROWTERMINATOR='0x0a', TABLOCK);

-- dim_date: build 120-day window around seed dates + festival flag (festival = 30..37 days ago)
-- Re-run after each seed.
GO
MERGE dbo.dim_date AS t
USING (
  SELECT DISTINCT CAST(order_date AS DATE) AS d FROM dbo.fact_orders
) s ON t.date_id = s.d
WHEN NOT MATCHED THEN INSERT (date_id, week_id, month_id, is_festival)
VALUES (s.d,
  CONVERT(NVARCHAR(10), DATEADD(WEEK, DATEDIFF(WEEK, 0, s.d), 0), 23),
  CONVERT(NVARCHAR(7), s.d, 23),
  CASE WHEN DATEDIFF(DAY, s.d, CAST(GETDATE() AS DATE)) BETWEEN 30 AND 37 THEN 1 ELSE 0 END);
GO

SELECT (SELECT COUNT(*) FROM dbo.fact_orders) AS orders,
       (SELECT COUNT(*) FROM dbo.fact_settlements) AS settlements,
       (SELECT COUNT(*) FROM dbo.dim_date) AS dim_dates;
