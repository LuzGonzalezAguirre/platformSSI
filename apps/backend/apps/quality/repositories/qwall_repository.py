import os
import requests
from datetime import date
from django.core.cache import cache

PROXY_URL  = os.getenv("QWALL_PROXY_URL",   "http://host.docker.internal:8002")
PROXY_TOKEN = os.getenv("QWALL_PROXY_TOKEN", "")
HEADERS    = {"Authorization": f"Bearer {PROXY_TOKEN}"}
CACHE_TTL  = 300


class QWallRepository:

    @staticmethod
    def get_inspections(start_date: date, end_date: date) -> list[dict]:
        cache_key = f"qwall:raw:{start_date}:{end_date}"
        cached    = cache.get(cache_key)
        if cached is not None:
            return cached

        resp = requests.post(
            f"{PROXY_URL}/inspections",
            json={
                "start_date": start_date.strftime("%Y-%m-%d"),
                "end_date":   end_date.strftime("%Y-%m-%d"),
            },
            headers=HEADERS,
            timeout=30,
        )
        resp.raise_for_status()
        rows = resp.json().get("data", [])
        cache.set(cache_key, rows, CACHE_TTL)
        return rows