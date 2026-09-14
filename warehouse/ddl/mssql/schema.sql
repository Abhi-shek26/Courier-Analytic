-- Star schema for Courier-Analytic (MS SQL Server 2019+, PRIMARY)
-- Portable siblings: ../postgres/schema.sql, ../snowflake/schema.sql (same grain)
-- Grain: one row per AWB per settlement batch
-- Run in SSMS against database CourierAnalytic

IF OBJECT_ID('dbo.dim_courier','U') IS NULL
CREATE TABLE dbo.dim_courier (
  courier_id   SMALLINT PRIMARY KEY,
  courier_name NVARCHAR(50) NOT NULL UNIQUE,
  base_rate_rs DECIMAL(10,2) NOT NULL,
  sla_hours    INT NOT NULL
);

IF OBJECT_ID('dbo.dim_geography','U') IS NULL
CREATE TABLE dbo.dim_geography (
  geo_id SMALLINT PRIMARY KEY,
  city   NVARCHAR(50) NOT NULL,
  tier   NVARCHAR(10) NOT NULL CHECK (tier IN (N'Tier-1',N'Tier-2',N'Tier-3')),
  zone   NVARCHAR(20) NOT NULL
);

IF OBJECT_ID('dbo.dim_merchant','U') IS NULL
CREATE TABLE dbo.dim_merchant (
  merchant_id   NVARCHAR(20) PRIMARY KEY,
  merchant_name NVARCHAR(100) NOT NULL,
  category      NVARCHAR(20) NOT NULL CHECK (category IN (N'Grocery',N'Food',N'Pharmacy',N'D2C'))
);

IF OBJECT_ID('dbo.dim_date','U') IS NULL
CREATE TABLE dbo.dim_date (
  date_id     DATE PRIMARY KEY,
  week_id     NVARCHAR(10) NOT NULL,
  month_id    NVARCHAR(7) NOT NULL,
  is_festival BIT NOT NULL DEFAULT 0
);

IF OBJECT_ID('dbo.fact_orders','U') IS NULL
CREATE TABLE dbo.fact_orders (
  order_id         NVARCHAR(20) PRIMARY KEY,
  awb_number       NVARCHAR(20) NOT NULL UNIQUE,
  courier_id       SMALLINT NOT NULL REFERENCES dbo.dim_courier(courier_id),
  merchant_id      NVARCHAR(20) NOT NULL REFERENCES dbo.dim_merchant(merchant_id),
  geo_id           SMALLINT NOT NULL REFERENCES dbo.dim_geography(geo_id),
  order_date       DATE NOT NULL,
  delivery_date    DATE NULL,
  order_status     NVARCHAR(20) NOT NULL CHECK (order_status IN (N'DELIVERED',N'RTO',N'IN_TRANSIT',N'LOST')),
  payment_mode     NVARCHAR(20) NOT NULL CHECK (payment_mode IN (N'COD',N'Prepaid')),
  cod_amount       DECIMAL(12,2) NOT NULL DEFAULT 0,
  declared_weight  DECIMAL(8,3) NOT NULL,
  order_value      DECIMAL(12,2) NOT NULL,
  promised_eta_hrs INT NOT NULL,
  actual_eta_hrs   DECIMAL(8,2) NULL
);
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name='ix_orders_courier_date')
  CREATE INDEX ix_orders_courier_date ON dbo.fact_orders (courier_id, order_date);
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name='ix_orders_geo')
  CREATE INDEX ix_orders_geo ON dbo.fact_orders (geo_id);
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name='ix_orders_awb')
  CREATE INDEX ix_orders_awb ON dbo.fact_orders (awb_number);

IF OBJECT_ID('dbo.fact_settlements','U') IS NULL
CREATE TABLE dbo.fact_settlements (
  settlement_id   NVARCHAR(20) PRIMARY KEY,
  awb_number      NVARCHAR(20) NOT NULL,
  batch_id        NVARCHAR(20) NOT NULL,
  courier_id      SMALLINT NOT NULL REFERENCES dbo.dim_courier(courier_id),
  settlement_date DATE NOT NULL,
  settled_cod     DECIMAL(12,2) NOT NULL DEFAULT 0,
  charged_weight  DECIMAL(8,3) NOT NULL,
  forward_charge  DECIMAL(10,2) NOT NULL DEFAULT 0,
  rto_charge      DECIMAL(10,2) NOT NULL DEFAULT 0,
  cod_fee         DECIMAL(10,2) NOT NULL DEFAULT 0
);
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name='ix_settle_awb')
  CREATE INDEX ix_settle_awb ON dbo.fact_settlements (awb_number);
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name='ix_settle_batch')
  CREATE INDEX ix_settle_batch ON dbo.fact_settlements (batch_id);
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name='ix_settle_courier_date')
  CREATE INDEX ix_settle_courier_date ON dbo.fact_settlements (courier_id, settlement_date);

IF OBJECT_ID('dbo.fact_discrepancies','U') IS NULL
CREATE TABLE dbo.fact_discrepancies (
  discrepancy_id   NVARCHAR(30) PRIMARY KEY,
  awb_number       NVARCHAR(20) NOT NULL,
  batch_id         NVARCHAR(20) NOT NULL,
  courier_id       SMALLINT NOT NULL REFERENCES dbo.dim_courier(courier_id),
  merchant_id      NVARCHAR(20) NOT NULL REFERENCES dbo.dim_merchant(merchant_id),
  geo_id           SMALLINT NOT NULL REFERENCES dbo.dim_geography(geo_id),
  discrepancy_type NVARCHAR(30) NOT NULL CHECK (discrepancy_type IN (
    N'COD_SHORT_REMITTANCE',N'WEIGHT_DISPUTE',N'PHANTOM_RTO_CHARGE',
    N'OVERDUE_REMITTANCE',N'DUPLICATE_SETTLEMENT',N'ETA_SLA_BREACH',N'EXCESS_FORWARD_CHARGE')),
  expected_value DECIMAL(12,2) NULL,
  actual_value   DECIMAL(12,2) NULL,
  variance_rs    DECIMAL(12,2) NOT NULL DEFAULT 0,
  severity       NVARCHAR(10) NOT NULL DEFAULT N'MEDIUM' CHECK (severity IN (N'HIGH',N'MEDIUM',N'LOW')),
  detected_at    DATETIME2 NOT NULL DEFAULT SYSDATETIME()
);
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name='ix_disc_type')
  CREATE INDEX ix_disc_type ON dbo.fact_discrepancies (discrepancy_type);
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name='ix_disc_courier')
  CREATE INDEX ix_disc_courier ON dbo.fact_discrepancies (courier_id);
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name='ix_disc_geo')
  CREATE INDEX ix_disc_geo ON dbo.fact_discrepancies (geo_id);

IF OBJECT_ID('dbo.fct_daily_kpis','U') IS NULL
CREATE TABLE dbo.fct_daily_kpis (
  kpi_date      DATE NOT NULL,
  courier_id    SMALLINT NOT NULL REFERENCES dbo.dim_courier(courier_id),
  geo_id        SMALLINT NOT NULL REFERENCES dbo.dim_geography(geo_id),
  orders        INT NOT NULL DEFAULT 0,
  disputed_awbs INT NOT NULL DEFAULT 0,
  leakage_rs    DECIMAL(14,2) NOT NULL DEFAULT 0,
  avg_dso_days  DECIMAL(8,2) NULL,
  CONSTRAINT PK_fct_daily_kpis PRIMARY KEY (kpi_date, courier_id, geo_id)
);
