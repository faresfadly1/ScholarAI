import threading
import time
from collections import defaultdict, deque

from fastapi import HTTPException, Request
from redis import Redis

from app.core.config import settings

local_buckets = defaultdict(deque)
lock = threading.Lock()
redis_client = Redis.from_url(settings.redis_url) if settings.redis_url else None


def limit(request: Request, bucket: str, maximum: int, user_id: str = ""):
    identity = user_id or (request.client.host if request.client else "unknown")
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
