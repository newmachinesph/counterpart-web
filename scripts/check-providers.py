"""Read-only credential and connectivity checks. Never prints credentials."""
import json
import os
import smtplib
import ssl
import urllib.request
import urllib.error

import boto3
import psycopg


def check(name, task):
    try:
        print(name, json.dumps(task()), flush=True)
    except Exception as error:
        print(name, "FAILED", type(error).__name__, flush=True)


def database():
    url = os.environ["PRODUCTION_DATABASE_URL"].replace("postgresql+psycopg://", "postgresql://")
    with psycopg.connect(url, connect_timeout=10) as db:
        db.execute("SET TRANSACTION READ ONLY")
        tables = [row[0] for row in db.execute("SELECT tablename FROM pg_tables WHERE schemaname='public'").fetchall()]
        return {"connected": True, "tables": tables}


def r2():
    client = boto3.client("s3", endpoint_url=os.environ["R2_ENDPOINT_URL"], region_name="auto",
        aws_access_key_id=os.environ["R2_ACCESS_KEY_ID"], aws_secret_access_key=os.environ["R2_SECRET_ACCESS_KEY"])
    client.head_bucket(Bucket="counterpart")
    return {"bucket": "counterpart", "accessible": True}


def smtp():
    with smtplib.SMTP(os.environ["PRODUCTION_SMTP_HOST"], 587, timeout=15) as server:
        server.starttls(context=ssl.create_default_context())
        server.login(os.environ["PRODUCTION_SMTP_USERNAME"], os.environ["PRODUCTION_SMTP_PASSWORD"])
    return {"authentication": True, "tls": True}


def redis():
    request = urllib.request.Request(os.environ["UPSTASH_REDIS_REST_URL"], data=b'["PING"]',
        headers={"Authorization": "Bearer " + os.environ["UPSTASH_REDIS_REST_TOKEN"], "Content-Type": "application/json"})
    return json.load(urllib.request.urlopen(request, timeout=15))


if __name__ == "__main__":
    for name, task in [("DigitalOcean PostgreSQL", database), ("R2", r2), ("ZeptoMail", smtp), ("Upstash", redis)]:
        check(name, task)
