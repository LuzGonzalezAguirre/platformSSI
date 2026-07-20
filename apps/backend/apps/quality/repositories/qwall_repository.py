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
    def get_inspections(start_date: date, end_date: date, bu_id: int | None = None) -> list[dict]:
        cache_key = f"qwall:raw:{start_date}:{end_date}:bu={bu_id or 'all'}"
        cached    = cache.get(cache_key)
        if cached is not None:
            return cached

        resp = requests.post(
            f"{PROXY_URL}/inspections",
            json={
                "start_date": start_date.strftime("%Y-%m-%d"),
                "end_date":   end_date.strftime("%Y-%m-%d"),
                "bu_id":      bu_id,
            },
            headers=HEADERS,
            timeout=30,
        )
        resp.raise_for_status()
        rows = resp.json().get("data", [])
        cache.set(cache_key, rows, CACHE_TTL)
        return rows

    @staticmethod
    def get_flag_count(start_date: date, end_date: date, bu_id: int | None = None) -> int:
        cache_key = f"qwall:flags:{bu_id or 'all'}:{start_date}:{end_date}"
        cached    = cache.get(cache_key)
        if cached is not None:
            return cached

        resp = requests.get(
            f"{PROXY_URL}/piece-flags/count",
            params={
                "start_date": start_date.strftime("%Y-%m-%d"),
                "end_date":   end_date.strftime("%Y-%m-%d"),
                **({"bu_id": bu_id} if bu_id else {}),
            },
            headers=HEADERS,
            timeout=30,
        )
        resp.raise_for_status()
        count = resp.json().get("flag_count", 0)
        cache.set(cache_key, count, CACHE_TTL)
        return count

    @staticmethod
    def get_piece_flags(start_date: date, end_date: date, bu_id: int | None = None) -> list[dict]:
        cache_key = f"qwall:piece_flags:{bu_id or 'all'}:{start_date}:{end_date}"
        cached    = cache.get(cache_key)
        if cached is not None:
            return cached

        resp = requests.get(
            f"{PROXY_URL}/piece-flags",
            params={
                "start_date": start_date.strftime("%Y-%m-%d"),
                "end_date":   end_date.strftime("%Y-%m-%d"),
                **({"bu_id": bu_id} if bu_id else {}),
            },
            headers=HEADERS,
            timeout=30,
        )
        resp.raise_for_status()
        rows = resp.json().get("data", [])
        cache.set(cache_key, rows, CACHE_TTL)
        return rows

    @staticmethod
    def get_business_units() -> list[dict]:
        cache_key = "qwall:business_units"
        cached    = cache.get(cache_key)
        if cached is not None:
            return cached

        resp = requests.get(
            f"{PROXY_URL}/settings/business-units",
            headers=HEADERS,
            timeout=15,
        )
        resp.raise_for_status()
        rows = resp.json().get("data", [])
        cache.set(cache_key, rows, CACHE_TTL)
        return rows

    @staticmethod
    def get_inspection_point_fails(start_date: date, end_date: date, bu_id: int | None = None) -> list[dict]:
        cache_key = f"qwall:point_fails:{bu_id or 'all'}:{start_date}:{end_date}"
        cached    = cache.get(cache_key)
        if cached is not None:
            return cached

        resp = requests.get(
            f"{PROXY_URL}/inspection-point-fails",
            params={
                "start_date": start_date.strftime("%Y-%m-%d"),
                "end_date":   end_date.strftime("%Y-%m-%d"),
                **({"bu_id": bu_id} if bu_id else {}),
            },
            headers=HEADERS,
            timeout=30,
        )
        resp.raise_for_status()
        rows = resp.json().get("data", [])
        cache.set(cache_key, rows, CACHE_TTL)
        return rows