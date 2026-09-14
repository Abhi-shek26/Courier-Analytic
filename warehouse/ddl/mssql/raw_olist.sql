-- Courier-Analytic: raw Olist tables (real 99k Brazilian e-commerce orders)
-- Lives next to the synthetic warehouse so both datasets query side-by-side.
-- Source: Kaggle olistbr/brazilian-ecommerce (see warehouse/seed/load_olist_mssql.py)
-- Run: sqlcmd -S localhost -E -C -d CourierAnalytic -i raw_olist.sql

IF OBJECT_ID('dbo.raw_olist_orders','U') IS NULL
CREATE TABLE dbo.raw_olist_orders (
  order_id                    NVARCHAR(40) NOT NULL,
  customer_id                 NVARCHAR(40) NOT NULL,
  order_status                NVARCHAR(20) NOT NULL,
  order_purchase_timestamp    DATETIME2 NULL,
  order_approved_at           DATETIME2 NULL,
  order_delivered_carrier_date DATETIME2 NULL,
  order_delivered_customer_date DATETIME2 NULL,
  order_estimated_delivery_date DATETIME2 NULL,
  CONSTRAINT PK_raw_olist_orders PRIMARY KEY (order_id)
);

IF OBJECT_ID('dbo.raw_olist_items','U') IS NULL
CREATE TABLE dbo.raw_olist_items (
  order_id            NVARCHAR(40) NOT NULL,
  order_item_id       INT NOT NULL,
  product_id          NVARCHAR(40) NOT NULL,
  seller_id           NVARCHAR(40) NOT NULL,
  shipping_limit_date DATETIME2 NULL,
  price               DECIMAL(12,2) NOT NULL,
  freight_value       DECIMAL(12,2) NOT NULL,
  CONSTRAINT PK_raw_olist_items PRIMARY KEY (order_id, order_item_id)
);
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name='ix_olist_items_seller')
  CREATE INDEX ix_olist_items_seller ON dbo.raw_olist_items (seller_id);

IF OBJECT_ID('dbo.raw_olist_payments','U') IS NULL
CREATE TABLE dbo.raw_olist_payments (
  order_id             NVARCHAR(40) NOT NULL,
  payment_sequential   INT NOT NULL,
  payment_type         NVARCHAR(20) NOT NULL,
  payment_installments INT NOT NULL DEFAULT 0,
  payment_value        DECIMAL(12,2) NOT NULL,
  CONSTRAINT PK_raw_olist_payments PRIMARY KEY (order_id, payment_sequential)
);

IF OBJECT_ID('dbo.raw_olist_reviews','U') IS NULL
CREATE TABLE dbo.raw_olist_reviews (
  review_id            NVARCHAR(40) NOT NULL,
  order_id             NVARCHAR(40) NOT NULL,
  review_score         TINYINT NOT NULL,
  review_comment_title NVARCHAR(200) NULL,
  review_comment_message NVARCHAR(MAX) NULL,
  review_creation_date DATETIME2 NULL,
  review_answer_timestamp DATETIME2 NULL,
  CONSTRAINT PK_raw_olist_reviews PRIMARY KEY (review_id)
);
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name='ix_olist_reviews_order')
  CREATE INDEX ix_olist_reviews_order ON dbo.raw_olist_reviews (order_id);
