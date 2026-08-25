import os
import requests
from datetime import date
from django.core.cache import cache

PROXY_URL  = os.getenv("QWALL_PROXY_URL",   "http://host.docker.internal:8002")
PROXY_TOKEN = os.getenv("QWALL_PROXY_TOKEN", "")
HEADERS    = {"Authorization": f"Bearer {PROXY_TOKEN}"}
CACHE_TTL  = 300


def _normalize_bu_ids(bu_ids: int | list[int] | None) -> list[int] | None:
    """
    Acepta int suelto (compat con get_trend/get_pareto/get_part_number_summary,
    que siguen mandando un solo bu_id) o una lista real (get_report, multi-select).
    Normaliza a lista ordenada y deduplicada, o None si no hay filtro.

    Esto existe para NO forzar a get_trend/get_pareto/get_part_number_summary a
    cambiar su firma solo porque get_report ahora soporta multi-select -- esos
    tres siguen fuera de alcance de este cambio.
    """
    if bu_ids is None:
        return None
    if isinstance(bu_ids, int):
        return [bu_ids]
    normalized = sorted({int(b) for b in bu_ids})
    return normalized or None


def _bu_cache_fragment(bu_ids: list[int] | None) -> str:
    return ",".join(str(b) for b in bu_ids) if bu_ids else "all"


class QWallRepository:

    @staticmethod
    def get_inspections(start_date: date, end_date: date, bu_ids: int | list[int] | None = None) -> list[dict]:
        normalized = _normalize_bu_ids(bu_ids)
        cache_key  = f"qwall:raw:{start_date}:{end_date}:bu={_bu_cache_fragment(normalized)}"
        cached     = cache.get(cache_key)
        if cached is not None:
            return cached

        resp = requests.post(
            f"{PROXY_URL}/inspections",
            json={
                "start_date": start_date.strftime("%Y-%m-%d"),
                "end_date":   end_date.strftime("%Y-%m-%d"),
                "bu_ids":     normalized,
            },
            headers=HEADERS,
            timeout=30,
        )
        resp.raise_for_status()
        rows = resp.json().get("data", [])
        cache.set(cache_key, rows, CACHE_TTL)
        return rows

    @staticmethod
    def get_flag_count(start_date: date, end_date: date, bu_ids: int | list[int] | None = None) -> int:
        normalized = _normalize_bu_ids(bu_ids)
        cache_key  = f"qwall:flags:{_bu_cache_fragment(normalized)}:{start_date}:{end_date}"
        cached     = cache.get(cache_key)
        if cached is not None:
            return cached

        resp = requests.get(
            f"{PROXY_URL}/piece-flags/count",
            params={
                "start_date": start_date.strftime("%Y-%m-%d"),
                "end_date":   end_date.strftime("%Y-%m-%d"),
                **({"bu_ids": normalized} if normalized else {}),
            },
            headers=HEADERS,
            timeout=30,
        )
        resp.raise_for_status()
        count = resp.json().get("flag_count", 0)
        cache.set(cache_key, count, CACHE_TTL)
        return count

    @staticmethod
    def get_piece_flags(start_date: date, end_date: date, bu_ids: int | list[int] | None = None) -> list[dict]:
        normalized = _normalize_bu_ids(bu_ids)
        cache_key  = f"qwall:piece_flags:{_bu_cache_fragment(normalized)}:{start_date}:{end_date}"
        cached     = cache.get(cache_key)
        if cached is not None:
            return cached

        resp = requests.get(
            f"{PROXY_URL}/piece-flags",
            params={
                "start_date": start_date.strftime("%Y-%m-%d"),
                "end_date":   end_date.strftime("%Y-%m-%d"),
                **({"bu_ids": normalized} if normalized else {}),
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