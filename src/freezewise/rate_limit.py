"""Simple in-memory rate limiter for AI endpoints."""

from __future__ import annotations

import asyncio
import time

from fastapi import HTTPException, Request


class RateLimiter:
    """Token-bucket rate limiter keyed by client IP.

    Args:
        max_requests: Maximum requests allowed per window.
        window_seconds: Time window in seconds.
        max_clients: Maximum tracked IPs (LRU eviction prevents memory leak).
    """

    def __init__(
        self,
        max_requests: int = 10,
        window_seconds: int = 60,
        max_clients: int = 4096,
    ) -> None:
        self._max = max_requests
        self._window = window_seconds
        self._max_clients = max_clients
        self._clients: dict[str, list[float]] = {}
        self._lock = asyncio.Lock()

    async def check(self, request: Request) -> None:
        """Raise 429 if client exceeds rate limit."""
        client_ip = request.client.host if request.client else "unknown"
        now = time.monotonic()

        async with self._lock:
            # Evict oldest clients if too many tracked
            if len(self._clients) > self._max_clients:
                oldest_key = next(iter(self._clients))
                del self._clients[oldest_key]

            timestamps = self._clients.get(client_ip, [])
            # Remove expired timestamps
            cutoff = now - self._window
            timestamps = [t for t in timestamps if t > cutoff]

            if len(timestamps) >= self._max:
                raise HTTPException(
                    status_code=429,
                    detail="Too many requests. Please try again later.",
                )

            timestamps.append(now)
            self._clients[client_ip] = timestamps


# Shared limiter instances
ai_search_limiter = RateLimiter(max_requests=10, window_seconds=60)
ai_scan_limiter = RateLimiter(max_requests=5, window_seconds=60)
ai_recipe_limiter = RateLimiter(max_requests=10, window_seconds=60)
