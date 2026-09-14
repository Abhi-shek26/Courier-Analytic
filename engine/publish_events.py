"""Publish discrepancy JSONL events to Kafka (Redpanda localhost:9092)."""
import json
import sys
from kafka import KafkaProducer

TOPIC = "discrepancy.events"


def publish(path, bootstrap="localhost:9092"):
    n = 0
    producer = KafkaProducer(
        bootstrap_servers=bootstrap,
        value_serializer=lambda v: json.dumps(v).encode("utf-8"),
        key_serializer=lambda k: k.encode("utf-8"),
        acks="all", retries=3,
    )
    with open(path, encoding="utf-8") as f:
        for line in f:
            evt = json.loads(line)
            producer.send(TOPIC, key=evt["discrepancy_id"], value=evt)
            n += 1
    producer.flush(30)
    print(f"published {n} events to {TOPIC}")
    return n


if __name__ == "__main__":
    publish(sys.argv[2] if len(sys.argv) > 2 and sys.argv[1] == "--file" else sys.argv[1])
