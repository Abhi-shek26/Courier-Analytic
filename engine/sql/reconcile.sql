-- Courier-Analytic L2: 7-rule set-based reconciliation (T-SQL, SSMS + sqlcmd ready)
-- Idempotent: re-running for a batch deletes + reinserts its discrepancies.
-- Run: sqlcmd -S localhost -E -C -d CourierAnalytic -i reconcile.sql
-- Then: EXEC dbo.sp_reconcile_batch @batchId = NULL;  -- NULL = all batches

-- discrepancy_id must hold awb|batch|type
IF COL_LENGTH('dbo.fact_discrepancies','discrepancy_id') IS NOT NULL
  AND (SELECT CHARACTER_MAXIMUM_LENGTH FROM INFORMATION_SCHEMA.COLUMNS
       WHERE TABLE_NAME='fact_discrepancies' AND COLUMN_NAME='discrepancy_id') < 80
  ALTER TABLE dbo.fact_discrepancies ALTER COLUMN discrepancy_id NVARCHAR(80) NOT NULL;
GO

CREATE OR ALTER PROCEDURE dbo.sp_reconcile_batch
  @batchId NVARCHAR(20) = NULL
AS
BEGIN
  SET NOCOUNT ON;

  DELETE FROM dbo.fact_discrepancies
  WHERE (@batchId IS NULL OR batch_id = @batchId);

  -- Rule 1: COD short-remittance — settled < cod - min(2%, Rs 10)
  INSERT INTO dbo.fact_discrepancies
    (discrepancy_id, awb_number, batch_id, courier_id, merchant_id, geo_id,
     discrepancy_type, expected_value, actual_value, variance_rs, severity)
  SELECT CONCAT(s.awb_number,'|',s.batch_id,'|COD_SHORT_REMITTANCE'),
    s.awb_number, s.batch_id, s.courier_id, o.merchant_id, o.geo_id,
    N'COD_SHORT_REMITTANCE', o.cod_amount, s.settled_cod,
    o.cod_amount - s.settled_cod,
    CASE WHEN o.cod_amount - s.settled_cod > 500 THEN N'HIGH'
         WHEN o.cod_amount - s.settled_cod > 100 THEN N'MEDIUM' ELSE N'LOW' END
  FROM dbo.fact_settlements s
  JOIN dbo.fact_orders o ON o.awb_number = s.awb_number
  WHERE (@batchId IS NULL OR s.batch_id = @batchId)
    AND o.cod_amount > 0
    AND s.settled_cod < o.cod_amount
      - CASE WHEN o.cod_amount * 0.02 < 10 THEN o.cod_amount * 0.02 ELSE 10 END;

  -- Rule 2: Weight dispute — charged > declared * 1.10 (leakage @ Rs 60/kg proxy)
  INSERT INTO dbo.fact_discrepancies
    (discrepancy_id, awb_number, batch_id, courier_id, merchant_id, geo_id,
     discrepancy_type, expected_value, actual_value, variance_rs, severity)
  SELECT CONCAT(s.awb_number,'|',s.batch_id,'|WEIGHT_DISPUTE'),
    s.awb_number, s.batch_id, s.courier_id, o.merchant_id, o.geo_id,
    N'WEIGHT_DISPUTE', o.declared_weight, s.charged_weight,
    ROUND((s.charged_weight - o.declared_weight) * 60, 0),
    CASE WHEN (s.charged_weight - o.declared_weight) * 60 > 500 THEN N'HIGH'
         WHEN (s.charged_weight - o.declared_weight) * 60 > 100 THEN N'MEDIUM' ELSE N'LOW' END
  FROM dbo.fact_settlements s
  JOIN dbo.fact_orders o ON o.awb_number = s.awb_number
  WHERE (@batchId IS NULL OR s.batch_id = @batchId)
    AND s.charged_weight > o.declared_weight * 1.10;

  -- Rule 3: Phantom RTO — rto > 0 on DELIVERED
  INSERT INTO dbo.fact_discrepancies
    (discrepancy_id, awb_number, batch_id, courier_id, merchant_id, geo_id,
     discrepancy_type, expected_value, actual_value, variance_rs, severity)
  SELECT CONCAT(s.awb_number,'|',s.batch_id,'|PHANTOM_RTO_CHARGE'),
    s.awb_number, s.batch_id, s.courier_id, o.merchant_id, o.geo_id,
    N'PHANTOM_RTO_CHARGE', 0, s.rto_charge, s.rto_charge,
    CASE WHEN s.rto_charge > 500 THEN N'HIGH'
         WHEN s.rto_charge > 100 THEN N'MEDIUM' ELSE N'LOW' END
  FROM dbo.fact_settlements s
  JOIN dbo.fact_orders o ON o.awb_number = s.awb_number
  WHERE (@batchId IS NULL OR s.batch_id = @batchId)
    AND s.rto_charge > 0 AND o.order_status = N'DELIVERED';

  -- Rule 4: Overdue remittance — DSO > 14 days (variance = cash stuck)
  INSERT INTO dbo.fact_discrepancies
    (discrepancy_id, awb_number, batch_id, courier_id, merchant_id, geo_id,
     discrepancy_type, expected_value, actual_value, variance_rs, severity)
  SELECT CONCAT(s.awb_number,'|',s.batch_id,'|OVERDUE_REMITTANCE'),
    s.awb_number, s.batch_id, s.courier_id, o.merchant_id, o.geo_id,
    N'OVERDUE_REMITTANCE', 14, DATEDIFF(DAY, o.order_date, s.settlement_date),
    s.settled_cod,
    CASE WHEN DATEDIFF(DAY, o.order_date, s.settlement_date) > 28 THEN N'HIGH' ELSE N'MEDIUM' END
  FROM dbo.fact_settlements s
  JOIN dbo.fact_orders o ON o.awb_number = s.awb_number
  WHERE (@batchId IS NULL OR s.batch_id = @batchId)
    AND DATEDIFF(DAY, o.order_date, s.settlement_date) > 14;

  -- Rule 5: Duplicate settlement — same AWB in >1 batch
  INSERT INTO dbo.fact_discrepancies
    (discrepancy_id, awb_number, batch_id, courier_id, merchant_id, geo_id,
     discrepancy_type, expected_value, actual_value, variance_rs, severity)
  SELECT CONCAT(s.awb_number,'|',s.batch_id,'|DUPLICATE_SETTLEMENT'),
    s.awb_number, s.batch_id, s.courier_id, o.merchant_id, o.geo_id,
    N'DUPLICATE_SETTLEMENT', 1, t.cnt, s.settled_cod, N'HIGH'
  FROM dbo.fact_settlements s
  JOIN dbo.fact_orders o ON o.awb_number = s.awb_number
  JOIN (SELECT awb_number, COUNT(*) AS cnt FROM dbo.fact_settlements
        GROUP BY awb_number HAVING COUNT(*) > 1) t ON t.awb_number = s.awb_number
  WHERE (@batchId IS NULL OR s.batch_id = @batchId);

  -- Rule 6: ETA SLA breach — actual > promised * 1.3 (variance = Rs 0, counts to dispute rate)
  INSERT INTO dbo.fact_discrepancies
    (discrepancy_id, awb_number, batch_id, courier_id, merchant_id, geo_id,
     discrepancy_type, expected_value, actual_value, variance_rs, severity)
  SELECT CONCAT(s.awb_number,'|',s.batch_id,'|ETA_SLA_BREACH'),
    s.awb_number, s.batch_id, s.courier_id, o.merchant_id, o.geo_id,
    N'ETA_SLA_BREACH', o.promised_eta_hrs, o.actual_eta_hrs, 0, N'LOW'
  FROM dbo.fact_settlements s
  JOIN dbo.fact_orders o ON o.awb_number = s.awb_number
  WHERE (@batchId IS NULL OR s.batch_id = @batchId)
    AND o.order_status = N'DELIVERED' AND o.actual_eta_hrs IS NOT NULL
    AND o.actual_eta_hrs > o.promised_eta_hrs * 1.3;

  -- Rule 7: Excess forward charge — forward > slab(declared) * 1.15
  INSERT INTO dbo.fact_discrepancies
    (discrepancy_id, awb_number, batch_id, courier_id, merchant_id, geo_id,
     discrepancy_type, expected_value, actual_value, variance_rs, severity)
  SELECT CONCAT(s.awb_number,'|',s.batch_id,'|EXCESS_FORWARD_CHARGE'),
    s.awb_number, s.batch_id, s.courier_id, o.merchant_id, o.geo_id,
    N'EXCESS_FORWARD_CHARGE',
    CASE WHEN o.declared_weight <= 1 THEN 42 WHEN o.declared_weight <= 3 THEN 65 ELSE 95 END,
    s.forward_charge,
    s.forward_charge - CASE WHEN o.declared_weight <= 1 THEN 42 WHEN o.declared_weight <= 3 THEN 65 ELSE 95 END,
    CASE WHEN s.forward_charge - CASE WHEN o.declared_weight <= 1 THEN 42 WHEN o.declared_weight <= 3 THEN 65 ELSE 95 END > 500 THEN N'HIGH'
         WHEN s.forward_charge - CASE WHEN o.declared_weight <= 1 THEN 42 WHEN o.declared_weight <= 3 THEN 65 ELSE 95 END > 100 THEN N'MEDIUM' ELSE N'LOW' END
  FROM dbo.fact_settlements s
  JOIN dbo.fact_orders o ON o.awb_number = s.awb_number
  WHERE (@batchId IS NULL OR s.batch_id = @batchId)
    AND s.forward_charge > CASE WHEN o.declared_weight <= 1 THEN 42 WHEN o.declared_weight <= 3 THEN 65 ELSE 95 END * 1.15;

  SELECT discrepancy_type, COUNT(*) AS cases, SUM(variance_rs) AS leakage_rs
  FROM dbo.fact_discrepancies
  WHERE (@batchId IS NULL OR batch_id = @batchId)
  GROUP BY discrepancy_type ORDER BY leakage_rs DESC;
END;
GO
