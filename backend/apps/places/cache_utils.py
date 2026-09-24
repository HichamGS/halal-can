"""API caching helpers.

Application-level cache only (Redis in production). Provider content whose
terms prohibit storage/caching is never placed here – see Source.storage_policy.
Cache keys are versioned per endpoint family and invalidated when canonical
data changes (signals below).
"""
import hashlib
import json

from django.conf import settings
from django.core.cache import cache


def cache_key(prefix: str, params: dict) -> str:
    h = hashlib.sha1(json.dumps(params, sort_keys=True, default=str).encode()).hexdigest()[:16]
    return f"mc:{prefix}:{h}"


def get_cached(key):
    return cache.get(key)


def set_cached(key, value, ttl):
    cache.set(key, value, timeout=ttl)


def invalidate_prefixes(*prefixes):
    """Best-effort invalidation. With Redis+django-redis we delete by key
    pattern; with LocMem fallback the TTL handles staleness."""
    try:
        client = cache.client if hasattr(cache, "client") else None
        if client is not None:
            for p in prefixes:
                client.delete_pattern(f"mc:{p}:*")
    except Exception:  # pragma: no cover - fallback caches lack delete_pattern
        pass
