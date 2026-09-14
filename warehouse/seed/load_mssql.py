"""Bulk-load Courier-Analytic seed CSVs into local MS SQL Server (Windows auth).

Usage:
    python load_mssql.py [--server localhost] [--db CourierAnalytic] [--dir ./output]

Empty strings -> NULL. Batches with fast_executemany. Idempotent-ish: truncates
fact tables first (dims re-merged).
"""
import argparse
import csv
import sys
import pyodbc

TABLES = [
    ("dim_courier", ["courier_id", "courier_name", "base_rate_rs", "sla_hours"]),
    ("dim_geography", ["geo_id", "city", "tier", "zone"]),
    ("dim_merchant", ["merchant_id", "merchant_name", "category"]),
    ("fact_orders", ["order_id", "awb_number", "courier_id", "merchant_id", "geo_id",
                      "order_date", "delivery_date", "order_status", "payment_mode",
                      "cod_amount", "declared_weight", "order_value",
                      "promised_eta_hrs", "actual_eta_hrs"]),
    ("fact_settlements", ["settlement_id", "awb_number", "batch_id", "courier_id",
                           "settlement_date", "settled_cod", "charged_weight",
                           "forward_charge", "rto_charge", "cod_fee"]),
]
FILES = {
    "dim_courier": "dim_courier.csv",
    "dim_geography": "dim_geography.csv",
    "dim_merchant": "dim_merchant.csv",
    "fact_orders": "fact_orders.csv",
    "fact_settlements": "fact_settlements.csv",
}


def read_csv(path, cols):
    with open(path, newline="", encoding="utf-8") as f:
        reader = csv.DictReader(f)
        rows = []
        for r in reader:
            rows.append(tuple((r[c] if r[c] != "" else None) for c in cols))
        return rows


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--server", default="localhost")
    ap.add_argument("--db", default="CourierAnalytic")
    ap.add_argument("--dir", default="./output")
    args = ap.parse_args()

    conn = pyodbc.connect(
        f"DRIVER={{ODBC Driver 18 for SQL Server}};SERVER={args.server};"
        f"DATABASE={args.db};Trusted_Connection=yes;TrustServerCertificate=yes;",
        autocommit=False,
    )
    cur = conn.cursor()
    cur.fast_executemany = True

    # Order matters (FKs): truncate facts first, then reload all
    for t in ("fact_settlements", "fact_orders", "dim_merchant", "dim_geography", "dim_courier"):
        cur.execute(f"DELETE FROM dbo.{t}")
    print("truncated existing rows")

    for table, cols in TABLES:
        path = f"{args.dir}/{FILES[table]}"
        rows = read_csv(path, cols)
        placeholders = ",".join("?" for _ in cols)
        cur.executemany(
            f"INSERT INTO dbo.{table} ({','.join(cols)}) VALUES ({placeholders})", rows)
        print(f"{table}: inserted {len(rows)}")

    # dim_date window + festival flag
    cur.execute("""
        MERGE dbo.dim_date AS t
        USING (SELECT DISTINCT CAST(order_date AS DATE) AS d FROM dbo.fact_orders) s
        ON t.date_id = s.d
        WHEN NOT MATCHED THEN INSERT (date_id, week_id, month_id, is_festival)
        VALUES (s.d,
          CONVERT(NVARCHAR(10), DATEADD(WEEK, DATEDIFF(WEEK, 0, s.d), 0), 23),
          CONVERT(NVARCHAR(7), s.d, 23),
          CASE WHEN DATEDIFF(DAY, s.d, CAST(GETDATE() AS DATE)) BETWEEN 30 AND 37 THEN 1 ELSE 0 END);
    """)
    conn.commit()

    for t, _ in TABLES:
        cur.execute(f"SELECT COUNT(*) FROM dbo.{t}")
        print(f"{t}: {cur.fetchone()[0]} rows")
    cur.execute("SELECT COUNT(*) FROM dbo.dim_date")
    print(f"dim_date: {cur.fetchone()[0]} rows")
    conn.close()


if __name__ == "__main__":
    sys.exit(main())
