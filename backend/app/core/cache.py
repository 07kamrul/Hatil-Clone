"""Thread-safe in-memory TTL + LRU cache for public API responses.

The backend runs as a single uvicorn process (see docker-entrypoint.sh), so a
process-local cache sees every request. Sync endpoints run in a threadpool,
hence the lock.
"""

import threading
import time
from collections import OrderedDict

from app.core.config import get_settings


class TTLCache:
    def __init__(self, max_entries: int, ttl_seconds: float) -> None:
        self.max_entries = max(1, max_entries)
        self.ttl_seconds = ttl_seconds
        self._entries: OrderedDict[str, tuple[float, object]] = OrderedDict()
        self._lock = threading.Lock()
        self.hits = 0
        self.misses = 0

    def get(self, key: str) -> object | None:
        now = time.monotonic()
        with self._lock:
            entry = self._entries.get(key)
            if entry is None:
                self.misses += 1
                return None
            expires_at, value = entry
            if expires_at <= now:
                del self._entries[key]
                self.misses += 1
                return None
            self._entries.move_to_end(key)
            self.hits += 1
            return value

    def set(self, key: str, value: object) -> None:
        expires_at = time.monotonic() + self.ttl_seconds
        with self._lock:
            self._entries[key] = (expires_at, value)
            self._entries.move_to_end(key)
            while len(self._entries) > self.max_entries:
                self._entries.popitem(last=False)

    def clear(self) -> int:
        with self._lock:
            count = len(self._entries)
            self._entries.clear()
            return count

    def __len__(self) -> int:
        with self._lock:
            return len(self._entries)


def _from_settings() -> TTLCache:
    settings = get_settings()
    return TTLCache(max_entries=settings.cache_max_entries, ttl_seconds=settings.cache_ttl_seconds)


response_cache = _from_settings()


def cache_key(request_path: str, query_string: bytes) -> str:
    return f"{request_path}?{query_string.decode('latin-1')}" if query_string else request_path
