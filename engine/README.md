# Engine (L2) — reconciliation + streaming

Set-based T-SQL engine + Python runner + Kafka events.

```
engine/
  sql/reconcile.sql    — dbo.sp_reconcile_batch, 7 rules, idempotent
  reconcile.py         — run proc → export events/*.jsonl → publish to Kafka → (mart refresh via mssql model)
  publish_events.py    — Kafka publisher, topic discrepancy.events
  requirements.txt     — pyodbc, kafka-python
  events/              — git-ignored JSONL exports (sample committed)
```

## Rules (variance in Rs)
1. `COD_SHORT_REMITTANCE` — settled < cod − min(2%, ₹10); variance = shortfall
2. `WEIGHT_DISPUTE` — charged > declared×1.10; variance = excess kg × ₹60
3. `PHANTOM_RTO_CHARGE` — rto > 0 on DELIVERED; variance = rto charge
4. `OVERDUE_REMITTANCE` — DSO > 14d; variance = cash stuck (settled_cod)
5. `DUPLICATE_SETTLEMENT` — AWB in >1 batch; variance = settled_cod, HIGH
6. `ETA_SLA_BREACH` — actual > promised×1.3; variance 0, LOW (hits dispute rate)
7. `EXCESS_FORWARD_CHARGE` — forward > slab×1.15; variance = excess

Severity: HIGH > ₹500, MEDIUM > ₹100, else LOW.

## Run
```bash
# proc only (SSMS/sqlcmd)
sqlcmd -S localhost -E -C -d CourierAnalytic -Q "EXEC dbo.sp_reconcile_batch @batchId = NULL"

# full pipeline (6,456 events on 25k seed, ~₹22.3L leakage)
pip install -r requirements.txt
python reconcile.py
```
Kafka: Apache Kafka (KRaft, `docker compose up -d kafka`) → `localhost:29092`, topic auto-created on first publish.
