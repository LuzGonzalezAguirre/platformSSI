# apps/quality/repositories/incoming_inspection_plex_repository.py
"""
Repository de Plex para Incoming Inspection — SOLO debe ser llamado desde
apps.quality.tasks (Celery). Ninguna view/service de request-time debe
importar esto directamente.
"""
import os
import requests
from datetime import datetime, timedelta

PROXY_URL = os.getenv("PLEX_PROXY_URL", "http://host.docker.internal:8001")
PROXY_SECRET = os.getenv("PLEX_PROXY_SECRET", "")
HEADERS = {"Authorization": f"Bearer {PROXY_SECRET}"}
TIMEOUT = 300


def fetch_current_snapshot() -> list[dict]:
    resp = requests.post(
        f"{PROXY_URL}/incoming-inspection/snapshot",
        headers=HEADERS,
        timeout=TIMEOUT,
    )
    resp.raise_for_status()
    return resp.json().get("data", [])


def fetch_history_since(watermark: datetime, until: datetime) -> list[dict]:
    """Fetch an exclusive datetime range in Plex-safe 168-day windows."""
    rows: list[dict] = []
    current = watermark
    while current < until:
        chunk_end = min(current + timedelta(days=168), until)
        resp = requests.post(
            f"{PROXY_URL}/incoming-inspection/history",
            json={
                "since": current.strftime("%Y-%m-%d %H:%M:%S"),
                "until": chunk_end.strftime("%Y-%m-%d %H:%M:%S"),
            },
            headers=HEADERS,
            timeout=TIMEOUT,
        )
        resp.raise_for_status()
        rows.extend(resp.json().get("data", []))
        current = chunk_end
    return rows
