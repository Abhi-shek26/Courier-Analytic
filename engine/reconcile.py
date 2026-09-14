"""Courier-Analytic L2 runner: reconcile -> events -> mart.

Usage:
    python reconcile.py [--batch BATCH-B] [--skip-proc] [--no-publish]
    python publish_events.py --file events/discrepancies_<ts>.jsonl

Flow: dbo.sp_reconcile_batch (T-SQL, 7 rules) -> export JSONL ->
      Kafka topic discrepancy.events (Redpanda localhost:9092) ->
      refresh dbo.fct_daily_kpis.
"""
import argparse
import datetime
import json
import pathlib
import pyodbc

CS = ("DRIVER={ODBC Driver 18 for SQL Server};SERVER=localhost;"
      "DATABASE=CourierAnalytic;Trusted_Connection=yes;TrustServerCertificate=yes;")
EVENTS = pathlib.Path(__file__).parent / "events"
COLS = ["discrepancy_id", "awb_number", "batch_id", "courier_id", "merchant_id",
        "geo_id", "discrepancy_type", "expected_value", "actual_value",
        "variance_rs", "severity"]


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--batch", default=None)
    ap.add_argument("--skip-proc", action="store_true")
    ap.add_argument("--no-publish", action="store_true")
    args = ap.parse_args()

    conn = pyodbc.connect(CS, autocommit=True)
    cur = conn.cursor()

    if not args.skip_proc:
        print(f"running sp_reconcile_batch(batch={args.batch}) ...")
        cur.execute("{CALL dbo.sp_reconcile_batch (?)}", args.batch)
        for row in cur.fetchall():
            print(f"  {row[0]}: {row[1]} cases, Rs {row[2]}")
        cur.nextset()

    filt = "WHERE (@batchId IS NULL OR batch_id = @batchId)" if False else ""
    cur.execute(
        "SELECT discrepancy_id, awb_number, batch_id, courier_id, merchant_id, geo_id,"
        " discrepancy_type, expected_value, actual_value, variance_rs, severity,"
        " detected_at FROM dbo.fact_discrepancies"
        + (" WHERE batch_id = ?" if args.batch else ""),
        ([] if not args.batch else [args.batch]))
    rows = cur.fetchall()
    cur.execute("SELECT SUM(variance_rs), COUNT(*) FROM dbo.fact_discrepancies"
                + (" WHERE batch_id = ?" if args.batch else ""),
                ([] if not args.batch else [args.batch]))
    total, n = cur.fetchone()
    print(f"exporting {n} events, leakage Rs {total}")

    EVENTS.mkdir(exist_ok=True)
    ts = datetime.datetime.now().strftime("%Y%m%d_%H%M%S")
    out = EVENTS / f"discrepancies_{ts}.jsonl"
    with open(out, "w", encoding="utf-8") as f:
        for r in rows:
            f.write(json.dumps({
                "discrepancy_id": r[0], "awb_number": r[1], "batch_id": r[2],
                "courier_id": r[3], "merchant_id": r[4], "geo_id": r[5],
                "discrepancy_type": r[6],
                "expected_value": float(r[7]) if r[7] is not None else None,
                "actual_value": float(r[8]) if r[8] is not None else None,
                "variance_rs": float(r[9]),
                "severity": r[10], "detected_at": str(r[11]),
                "idempotency_key": f"{r[0]}",
            }) + "\n")
    print(f"wrote {out}")
    conn.close()

    if not args.no_publish:
        from publish_events import publish
        publish(str(out))


if __name__ == "__main__":
    main()
