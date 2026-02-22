"""Redis cache client with simple get/set/delete helpers."""
import json
import logging
from typing import Any

import redis.asyncio as aioredis

from app.config import settings

logger = logging.getLogger(__name__)

_redis: aioredis.Redis | None = None


def get_redis() -> aioredis.Redis:
    global _redis
    if _redis is None:
        _redis = aioredis.from_url(
            settings.redis_url,
            encoding="utf-8",
            decode_responses=True,
        )
        logger.info("Redis client initialised", extra={"url": settings.redis_url})
    return _redis


async def cache_get(key: str) -> Any | None:
    r = get_redis()
    try:
        raw = await r.get(key)
        if raw:
            return json.loads(raw)
    except Exception as exc:
        logger.warning("Cache get failed", extra={"key": key, "error": str(exc)})
    return None


async def cache_set(key: str, value: Any, ttl: int = 300) -> None:
    r = get_redis()
    try:
        await r.set(key, json.dumps(value), ex=ttl)
    except Exception as exc:
        logger.warning("Cache set failed", extra={"key": key, "error": str(exc)})


async def cache_delete(key: str) -> None:
    r = get_redis()
    try:
        await r.delete(key)
    except Exception as exc:
        logger.warning("Cache delete failed", extra={"key": key, "error": str(exc)})


async def cache_delete_pattern(pattern: str) -> None:
    r = get_redis()
    try:
        keys = await r.keys(pattern)
        if keys:
            await r.delete(*keys)
    except Exception as exc:
        logger.warning("Cache pattern delete failed", extra={"pattern": pattern, "error": str(exc)})
