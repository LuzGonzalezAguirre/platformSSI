"""Persistent, verified monthly snapshots of raw Plex Work Requests.

Only a successfully completed Plex response is written. JSON files are private
server-side artifacts, not part of Git or the public API.
"""
from __future__ import annotations

import fcntl
import hashlib
import json
import os
import tempfile
from calendar import monthrange
from contextlib import contextmanager
from datetime import date, datetime, timedelta, timezone
from pathlib import Path
from typing import Callable

from apps.ssi_common.plex_ranges import date_chunks


SCHEMA_VERSION = 1
CACHE_DIR = Path(os.getenv("PLEX_WR_CACHE_DIR", "/var/cache/platformssi/plex_wr"))
CURRENT_TTL_SECONDS = int(os.getenv("PLEX_WR_CACHE_CURRENT_TTL_SECONDS", "900"))
HISTORY_TTL_SECONDS = int(os.getenv("PLEX_WR_CACHE_HISTORY_TTL_SECONDS", "2592000"))


def _months(start: date, end: date):
    cursor = start.replace(day=1)
    while cursor <= end:
        last_day = date(cursor.year, cursor.month, monthrange(cursor.year, cursor.month)[1])
        yield cursor, last_day
        cursor = last_day + timedelta(days=1)


def _path(month: date, root: Path) -> Path:
    return root / f"work_requests_{month:%Y_%m}.json"


@contextmanager
def _lock(path: Path):
    """Serialize checks/fetch/writes across Django and Celery processes."""
    path.parent.mkdir(parents=True, exist_ok=True, mode=0o700)
    with (path.parent / (path.name + ".lock")).open("a+b") as handle:
        fcntl.flock(handle.fileno(), fcntl.LOCK_EX)
        try:
            yield
        finally:
            fcntl.flock(handle.fileno(), fcntl.LOCK_UN)


def _checksum(rows: list[dict]) -> str:
    canonical = json.dumps(rows, ensure_ascii=False, sort_keys=True, separators=(",", ":"), default=str)
    return hashlib.sha256(canonical.encode("utf-8")).hexdigest()


def _load(path: Path, period_start: date, period_end: date, today: date) -> list[dict] | None:
    try:
        snapshot = json.loads(path.read_text(encoding="utf-8"))
        rows = snapshot["rows"]
        if (
            snapshot.get("schema_version") != SCHEMA_VERSION
            or snapshot.get("source") != "plex:/work-requests"
            or snapshot.get("start_date") != period_start.isoformat()
            or snapshot.get("end_date") != period_end.isoformat()
            or not isinstance(rows, list)
            or any(not isinstance(row, dict) for row in rows)
            or snapshot.get("row_count") != len(rows)
            or snapshot.get("sha256") != _checksum(rows)
        ):
            return None
        extracted = datetime.fromisoformat(snapshot["fetched_at"])
        if extracted.tzinfo is None:
            return None
        ttl = CURRENT_TTL_SECONDS if period_end >= today else HISTORY_TTL_SECONDS
        if (datetime.now(timezone.utc) - extracted).total_seconds() > ttl:
            return None
        return rows
    except (OSError, ValueError, TypeError, KeyError, json.JSONDecodeError):
        return None


def _store(path: Path, start: date, end: date, rows: list[dict]):
    payload = {
        "schema_version": SCHEMA_VERSION,
        "source": "plex:/work-requests",
        "start_date": start.isoformat(),
        "end_date": end.isoformat(),
        "fetched_at": datetime.now(timezone.utc).isoformat(),
        "row_count": len(rows),
        "sha256": _checksum(rows),
        "rows": rows,
    }
    path.parent.mkdir(parents=True, exist_ok=True, mode=0o700)
    fd, temp_name = tempfile.mkstemp(prefix=".wr-", suffix=".tmp", dir=path.parent)
    try:
        with os.fdopen(fd, "w", encoding="utf-8") as handle:
            json.dump(payload, handle, ensure_ascii=False, default=str)
            handle.flush()
            os.fsync(handle.fileno())
        os.chmod(temp_name, 0o600)
        os.replace(temp_name, path)
    finally:
        if os.path.exists(temp_name):
            os.unlink(temp_name)


def get_work_requests(
    start: date,
    end: date,
    fetch: Callable[[date, date], list[dict]],
    *,
    root: Path | None = None,
    today: date | None = None,
) -> list[dict]:
    """Read verified monthly JSON and fetch missing/expired periods from Plex.

    Full calendar months are cached (current month through today). Date-range
    filtering is applied on request_date before callers aggregate and scope BU.
    Failures are propagated; no empty/partial snapshot is created on failure.
    """
    if end < start:
        raise ValueError("Invalid Work Requests date range")
    root = root if root is not None else CACHE_DIR
    today = today or date.today()
    all_rows: list[dict] = []
    for month_start, month_end in _months(start, min(end, today)):
        period_end = min(month_end, today)
        path = _path(month_start, root)
        with _lock(path):
            rows = _load(path, month_start, period_end, today)
            if rows is None:
                rows = []
                # Keep each Plex ODBC query safely below its 180-day window.
                for chunk_start, chunk_end in date_chunks(month_start, period_end, chunk_days=31):
                    page = fetch(chunk_start, chunk_end)
                    if not isinstance(page, list) or any(not isinstance(row, dict) for row in page):
                        raise ValueError("Incomplete Plex Work Requests response; snapshot not written")
                    for row in page:
                        if not str(row.get("work_request_no") or "").strip():
                            raise ValueError("Plex Work Request without work_request_no; snapshot not written")
                        when = str(row.get("request_date") or "")[:10]
                        if not (chunk_start.isoformat() <= when <= chunk_end.isoformat()):
                            raise ValueError("Plex Work Request outside requested dates; snapshot not written")
                    rows.extend(page)
                # Only after all requested chunks succeed do we persist the month.
                _store(path, month_start, period_end, rows)
        all_rows.extend(
            row for row in rows
            if start.isoformat() <= str(row.get("request_date") or "")[:10] <= end.isoformat()
        )
    return all_rows
