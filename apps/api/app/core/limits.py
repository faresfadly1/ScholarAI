import secrets
import threading
import time
from collections import defaultdict, deque
from ipaddress import ip_address

from fastapi import HTTPException, Request
from redis import Redis

from app.core.config import settings

local_buckets = defaultdict(deque)
lock = threading.Lock()
redis_client = Redis.from_url(settings.redis_url) if settings.redis_url else None


def client_identity(request: Request):
    supplied_secret = request.headers.get("x-scholarai-proxy-secret", "")
    if settings.internal_proxy_secret and secrets.compare_digest(
        supplied_secret.encode(), settings.internal_proxy_secret.encode()
    ):
        try:
            return str(ip_address(request.headers.get("x-scholarai-client-ip", "")))
        except ValueError:
            pass
    return request.client.host if request.client else "unknown"


def limit(request: Request, bucket: str, maximum: int, user_id: str = ""):
    identity = user_id or client_identity(request)
    key = f"rate:{bucket}:{identity}:{int(time.time() // 60)}"
    if redis_client:
        count = redis_client.incr(key)
        if count == 1:
            redis_client.expire(key, 65)
    else:
        with lock:
            now = time.monotonic()
            stable_key = f"{bucket}:{identity}"
            times = local_buckets[stable_key]
            while times and times[0] < now - 60:
                times.popleft()
            times.append(now)
            count = len(times)
    if count > maximum:
        raise HTTPException(
            429, "Too many requests. Try again in a minute.", headers={"Retry-After": "60"}
        )
