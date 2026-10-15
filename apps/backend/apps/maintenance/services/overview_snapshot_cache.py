"""Persistent, audited Plex response cache for Maintenance Overview.

Keeps source response and filter-independent data; never stores user-specific BU
views or manual OEE overrides. A fresh Plex response is always required before
a response can be snapshotted. Requests remain keyed by exact date window.
"""
from __future__ import annotations

import hashlib
import json
import logging
import os
from datetime import date, datetime, timezone
from pathlib import Path
from typing import Callable

from apps.maintenance.services.work_requests_snapshot_cache import (
    CURRENT_TTL_SECONDS, HISTORY_TTL_SECONDS, _lock, _store,
)

logger = logging.getLogger(__name__)
SCHEMA = 1
CACHE_DIR = Path(os.getenv("PLEX_OVERVIEW_CACHE_DIR", "/var/cache/platformssi/plex_wr/overview"))
ENDPOINTS = frozenset({
    "/maintenance-kpis",
    "/maintenance-downtime-reasons",
    "/maintenance-downtime-detail",
    "/maintenance-downtime-by-month",
    "/oee-live",
})


def _file_path(endpoint: str, payload: dict, root: Path) -> Path:
    key = json.dumps([SCHEMA, endpoint, payload], sort_keys=True, separators=(",", ":"), default=str)
    digest = hashlib.sha256(key.encode("utf-8")).hexdigest()
    return root / endpoint.strip("/") / f"{digest}.json"


def _digest(response: dict) -> str:
    text = json.dumps(response, ensure_ascii=False, sort_keys=True, separators=(",", ":"), default=str)
    return hashlib.sha256(text.encode("utf-8")).hexdigest()


def _read(path: Path, endpoint: str, payload: dict, today: date) -> dict | None:
    try:
        doc = json.loads(path.read_text(encoding="utf-8"))
        result = doc["response"]
        if (
            doc.get("schema") != SCHEMA
            or doc.get("endpoint") != endpoint
            or doc.get("payload") != payload
            or not isinstance(result, dict)
            or doc.get("sha256") != _digest(result)
        ):
            return None
        stamp = datetime.fromisoformat(doc["fetched_at"])
        if stamp.tzinfo is None:
            return None
        period_end = date.fromisoformat(str(payload["end_date"]))
        ttl = CURRENT_TTL_SECONDS if period_end >= today else HISTORY_TTL_SECONDS
        age = (datetime.now(timezone.utc) - stamp).total_seconds()
        if age < 0 or age > ttl:
            return None
        return result
    except (OSError, ValueError, TypeError, KeyError):
        return None


def _write(path: Path, endpoint: str, payload: dict, response: dict):
    # Reuse the atomic snapshot writer. Its wrapper is only used to guarantee
    # complete writes and checksum; the endpoint checksum also covers metadata.
    import tempfile
    path.parent.mkdir(parents=True, exist_ok=True, mode=0o700)
    doc = {
        "schema": SCHEMA,
        "endpoint": endpoint,
        "payload": payload,
        "fetched_at": datetime.now(timezone.utc).isoformat(),
        "sha256": _digest(response),
        "response": response,
    }
    fd, name = tempfile.mkstemp(prefix=".overview-", suffix=".tmp", dir=path.parent)
    try:
        with os.fdopen(fd, "w", encoding="utf-8") as stream:
            json.dump(doc, stream, ensure_ascii=False, default=str)
            stream.flush()
            os.fsync(stream.fileno())
        os.chmod(name, 0o600)
        os.replace(name, path)
    finally:
        if os.path.exists(name):
            os.unlink(name)


def get_cached_response(
    endpoint: str,
    payload: dict,
    fetch: Callable[[], dict],
    *,
    root: Path | None = None,
    today: date | None = None,
) -> dict:
    if endpoint not in ENDPOINTS:
        return fetch()
    if not isinstance(payload, dict) or not all(
        isinstance(payload.get(name), str) for name in ("start_date", "end_date")
    ):
        return fetch()
    start, end = date.fromisoformat(payload["start_date"]), date.fromisoformat(payload["end_date"])
    if end < start or end > (today or date.today()):
        return fetch()

    root = root if root is not None else CACHE_DIR
    path = _file_path(endpoint, payload, root)
    with _lock(path):
        cached = _read(path, endpoint, payload, today or date.today())
        if cached is not None:
            return cached
        response = fetch()
        if not isinstance(response, dict) or not isinstance(response.get("data"), (dict, list)):
            # Do not turn an invalid/partial Plex response into a persistent source.
            raise ValueError(f"Invalid Plex response for {endpoint}; not cached")
        _write(path, endpoint, payload, response)
        return response
