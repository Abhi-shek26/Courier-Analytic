"""Load Olist raw CSVs into CourierAnalytic.raw_olist_* (both datasets, one DB).

Usage:
    python load_olist_mssql.py [--server localhost] [--db CourierAnalytic]

Source resolves via kagglehub cache (downloads on first run).
Vectorized conversion + per-table commits. Strips non-BMP chars from
review text (UCS-2 NVARCHAR limit).
"""
import argparse
import kagglehub
import math
import pandas as pd
import pyodbc
from pathlib import Path

TABLES = {
    "raw_olist_orders": (["order_id", "customer_id", "order_status",
                          "order_purchase_timestamp", "order_approved_at",
                          "order_delivered_carrier_date", "order_delivered_customer_date",
                          "order_estimated_delivery_date"], "olist_orders_dataset.csv"),
    "raw_olist_items": (["order_id", "order_item_id", "product_id", "seller_id",
                         "shipping_limit_date", "price", "freight_value"],
                        "olist_order_items_dataset.csv"),
    "raw_olist_payments": (["order_id", "payment_sequential", "payment_type",
                            "payment_installments", "payment_value"],
                           "olist_order_payments_dataset.csv"),
    "raw_olist_reviews": (["review_id", "order_id", "review_score",
                           "review_comment_title", "review_comment_message",
                           "review_creation_date", "review_answer_timestamp"],
                          "olist_order_reviews_dataset.csv"),
}
DATE_HINTS = ("timestamp", "approved_at", "carrier_date", "customer_date",
              "estimated_delivery_date", "shipping_limit_date",
              "creation_date", "answer_timestamp")
INT_COLS = {"order_item_id", "payment_sequential", "payment_installments", "review_score"}
FLOAT_COLS = {"price", "freight_value", "payment_value"}


def prep(df, cols):
    df = df[cols]
    for c in cols:
        if any(k in c for k in DATE_HINTS):
            s = pd.to_datetime(df[c], errors="coerce")
            df[c] = s.apply(lambda v: None if pd.isna(v) else v.strftime("%Y-%m-%d %H:%M:%S"))
        elif c in INT_COLS:
            df[c] = pd.to_numeric(df[c], errors="coerce").apply(
                lambda v: None if pd.isna(v) else int(v))
        elif c in FLOAT_COLS:
            df[c] = pd.to_numeric(df[c], errors="coerce").apply(
                lambda v: None if pd.isna(v) else float(v))
        else:
            df[c] = df[c].apply(
                lambda v: None if pd.isna(v) or str(v).strip() == ""
                else "".join(ch for ch in str(v) if ord(ch) <= 0xFFFF) or None)
    return df


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--server", default="localhost")
    ap.add_argument("--db", default="CourierAnalytic")
    args = ap.parse_args()

    src = Path(kagglehub.dataset_download("olistbr/brazilian-ecommerce"))
    conn = pyodbc.connect(
        f"DRIVER={{ODBC Driver 18 for SQL Server}};SERVER={args.server};"
        f"DATABASE={args.db};Trusted_Connection=yes;TrustServerCertificate=yes;",
        autocommit=True)
    cur = conn.cursor()
    cur.fast_executemany = True

    for table, (cols, fname) in TABLES.items():
        df = prep(pd.read_csv(src / fname, dtype=str, keep_default_na=True), cols)
        if table == "raw_olist_reviews":
            # review_id repeats for edited reviews — keep latest (same rule as 06 validation)
            df = df.sort_values("review_creation_date").drop_duplicates("review_id", keep="last")
        cur.execute(f"DELETE FROM dbo.{table}")
        rows = [tuple(None if (v is None or v is pd.NA
                               or (isinstance(v, float) and math.isnan(v)))
                       else v for v in r)
                for r in df.itertuples(index=False, name=None)]
        for i in range(0, len(rows), 20000):
            cur.executemany(
                f"INSERT INTO dbo.{table} ({','.join(cols)}) VALUES ({','.join('?' for _ in cols)})",
                rows[i:i + 20000])
            print(f"{table}: {min(i + 20000, len(rows))}/{len(rows)}", flush=True)
    for t in TABLES:
        cur.execute(f"SELECT COUNT(*) FROM dbo.{t}")
        print(f"{t}: {cur.fetchone()[0]} rows")
    conn.close()


if __name__ == "__main__":
    main()
