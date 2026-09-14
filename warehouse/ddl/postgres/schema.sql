-- Star schema for Courier Leakage Analytic (Postgres 16, local)
-- Prod target: Snowflake (see ../snowflake/schema.sql, same grain)
-- Grain: one row per AWB per settlement batch

CREATE TABLE IF NOT EXISTS dim_courier (
  courier_id   SMALLINT PRIMARY KEY,
  courier_name TEXT NOT NULL UNIQUE,
  base_rate_rs NUMERIC(10,2) NOT NULL,
  sla_hours    INT NOT NULL
);

CREATE TABLE IF NOT EXISTS dim_geography (
  geo_id SMALLINT PRIMARY KEY,
  city   TEXT NOT NULL,
  tier   TEXT NOT NULL CHECK (tier IN ('Tier-1','Tier-2','Tier-3')),
  zone   TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS dim_merchant (
  merchant_id   TEXT PRIMARY KEY,
  merchant_name TEXT NOT NULL,
  category      TEXT NOT NULL CHECK (category IN ('Grocery','Food','Pharmacy','D2C'))
);

CREATE TABLE IF NOT EXISTS dim_date (
  date_id     DATE PRIMARY KEY,
  week_id     TEXT NOT NULL,
  month_id    TEXT NOT NULL,
  is_festival BOOLEAN NOT NULL DEFAULT FALSE
);

CREATE TABLE IF NOT EXISTS fact_orders (
  order_id         TEXT PRIMARY KEY,
  awb_number       TEXT NOT NULL UNIQUE,
  courier_id       SMALLINT NOT NULL REFERENCES dim_courier(courier_id),
  merchant_id      TEXT NOT NULL REFERENCES dim_merchant(merchant_id),
  geo_id           SMALLINT NOT NULL REFERENCES dim_geography(geo_id),
  order_date       DATE NOT NULL,
  delivery_date    DATE,
  order_status     TEXT NOT NULL CHECK (order_status IN ('DELIVERED','RTO','IN_TRANSIT','LOST')),
  payment_mode     TEXT NOT NULL CHECK (payment_mode IN ('COD','Prepaid')),
  cod_amount       NUMERIC(12,2) NOT NULL DEFAULT 0,
  declared_weight  NUMERIC(8,3) NOT NULL,
  order_value      NUMERIC(12,2) NOT NULL,
  promised_eta_hrs INT NOT NULL,
  actual_eta_hrs   NUMERIC(8,2)
);
CREATE INDEX IF NOT EXISTS ix_orders_courier_date ON fact_orders (courier_id, order_date);
CREATE INDEX IF NOT EXISTS ix_orders_geo ON fact_orders (geo_id);
CREATE INDEX IF NOT EXISTS ix_orders_awb ON fact_orders (awb_number);

CREATE TABLE IF NOT EXISTS fact_settlements (
  settlement_id   TEXT PRIMARY KEY,
  awb_number      TEXT NOT NULL,
  batch_id        TEXT NOT NULL,
  courier_id      SMALLINT NOT NULL REFERENCES dim_courier(courier_id),
  settlement_date DATE NOT NULL,
  settled_cod     NUMERIC(12,2) NOT NULL DEFAULT 0,
  charged_weight  NUMERIC(8,3) NOT NULL,
  forward_charge  NUMERIC(10,2) NOT NULL DEFAULT 0,
  rto_charge      NUMERIC(10,2) NOT NULL DEFAULT 0,
  cod_fee         NUMERIC(10,2) NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS ix_settle_awb ON fact_settlements (awb_number);
CREATE INDEX IF NOT EXISTS ix_settle_batch ON fact_settlements (batch_id);
CREATE INDEX IF NOT EXISTS ix_settle_courier_date ON fact_settlements (courier_id, settlement_date);

CREATE TABLE IF NOT EXISTS fact_discrepancies (
  discrepancy_id   TEXT PRIMARY KEY,
  awb_number       TEXT NOT NULL,
  batch_id         TEXT NOT NULL,
  courier_id       SMALLINT NOT NULL REFERENCES dim_courier(courier_id),
  merchant_id      TEXT NOT NULL REFERENCES dim_merchant(merchant_id),
  geo_id           SMALLINT NOT NULL REFERENCES dim_geography(geo_id),
  discrepancy_type TEXT NOT NULL CHECK (discrepancy_type IN (
    'COD_SHORT_REMITTANCE','WEIGHT_DISPUTE','PHANTOM_RTO_CHARGE',
    'OVERDUE_REMITTANCE','DUPLICATE_SETTLEMENT','ETA_SLA_BREACH','EXCESS_FORWARD_CHARGE')),
  expected_value NUMERIC(12,2),
  actual_value   NUMERIC(12,2),
  variance_rs    NUMERIC(12,2) NOT NULL DEFAULT 0,
  severity       TEXT NOT NULL CHECK (severity IN ('HIGH','MEDIUM','LOW')) DEFAULT 'MEDIUM',
  detected_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS ix_disc_type ON fact_discrepancies (discrepancy_type);
CREATE INDEX IF NOT EXISTS ix_disc_courier ON fact_discrepancies (courier_id);
CREATE INDEX IF NOT EXISTS ix_disc_geo ON fact_discrepancies (geo_id);

-- Daily KPI mart (served to API / PowerBI, refreshed by dbt-style model)
CREATE TABLE IF NOT EXISTS fct_daily_kpis (
  kpi_date     DATE NOT NULL,
  courier_id   SMALLINT NOT NULL REFERENCES dim_courier(courier_id),
  geo_id       SMALLINT NOT NULL REFERENCES dim_geography(geo_id),
  orders       INT NOT NULL DEFAULT 0,
  disputed_awbs INT NOT NULL DEFAULT 0,
  leakage_rs   NUMERIC(14,2) NOT NULL DEFAULT 0,
  avg_dso_days NUMERIC(8,2),
  PRIMARY KEY (kpi_date, courier_id, geo_id)
);
