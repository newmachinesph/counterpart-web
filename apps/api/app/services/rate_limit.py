"""Shared fixed-window limits, namespaced to this application/environment."""
import hashlib

import httpx
import redis
from fastapi import HTTPException

from app.config import settings

SCRIPT = "local n=redis.call('INCR',KEYS[1]); if n==1 then redis.call('EXPIRE',KEYS[1],ARGV[1]) end; return n"


def check(bucket: str, identity: str, limit: int, seconds: int = 60):
    key = f"counterpart:{settings.app_env}:limit:{bucket}:" + hashlib.sha256(identity.encode()).hexdigest()
    if not settings.redis_url and not settings.upstash_redis_rest_url:
        return
    try:
        if settings.redis_url:
            with redis.Redis.from_url(settings.redis_url, socket_timeout=3) as client:
                count = int(client.eval(SCRIPT, 1, key, seconds))
        else:
            response = httpx.post(settings.upstash_redis_rest_url,
                headers={"Authorization": "Bearer " + settings.upstash_redis_rest_token},
                json=["EVAL", SCRIPT, "1", key, str(seconds)], timeout=5)
            response.raise_for_status()
            count = int(response.json()["result"])
    except (httpx.HTTPError, redis.RedisError, ValueError, KeyError, TypeError):
        raise HTTPException(503, "Please try again shortly.")
    if count > limit:
        raise HTTPException(429, "Too many attempts. Please wait a minute and try again.", headers={"Retry-After": str(seconds)})
