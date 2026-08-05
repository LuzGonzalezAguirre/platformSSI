# apps/maintenance/services/pmp_service.py
import calendar
import os
from collections import defaultdict

import requests
from django.core.cache import cache

from apps.ssi_common.bu_classification import resolve_bu_from_workcenter

PROXY_URL    = os.getenv("PLEX_PROXY_URL", "http://host.docker.internal:8001")
PROXY_SECRET = os.getenv("PLEX_PROXY_SECRET", "")
HEADERS      = {"Authorization": f"Bearer {PROXY_SECRET}"}

PM_TYPE_KEY   = int(os.getenv("PLEX_PM_TYPE_KEY", "1908"))
CACHE_VERSION = "v1"
CACHE_TTL     = 600

UNCLASSIFIED = "unclassified"


class PmpServiceError(Exception):
    """Fallo al obtener el programa de mantenimiento preventivo desde Plex."""


def _fetch_year_rows(year: int) -> list[dict]:
    """
    Una sola llamada al ERP por año, cacheada. La paginación mensual del
    frontend se resuelve rebanando este resultado -- nunca con una llamada
    por mes.
    """
    cache_key = f"pmp:{CACHE_VERSION}:year:{year}"
    cached    = cache.get(cache_key)
    if cached is not None:
        return cached

    try:
        resp = requests.post(
            f"{PROXY_URL}/work-requests",
            json={
                "start_date":            f"{year}-01-01",
                "end_date":              f"{year}-12-31",
                "work_request_type_key": PM_TYPE_KEY,
                "date_field":            "Due_Date",
            },
            headers=HEADERS,
            timeout=120,
        )
        resp.raise_for_status()
    except requests.Timeout as exc:
        raise PmpServiceError("El proxy de Plex no respondió a tiempo.") from exc
    except requests.HTTPError as exc:
        raise PmpServiceError("El proxy de Plex regresó un error.") from exc
    except requests.RequestException as exc:
        raise PmpServiceError("No se pudo conectar al proxy de Plex.") from exc

    rows = resp.json().get("data", [])

    for row in rows:
        bu = resolve_bu_from_workcenter(
            row.get("workcenter_group") or "",
            row.get("workcenter") or "",
        )
        row["bu"] = bu or UNCLASSIFIED

    rows = [r for r in rows if (r.get("due_date") or "")[:10]]
    rows.sort(key=lambda r: (r["due_date"][:10], r["work_request_no"]))

    cache.set(cache_key, rows, CACHE_TTL)
    return rows


def _count_by_bu(rows: list[dict]) -> list[dict]:
    acc: dict = defaultdict(int)
    for r in rows:
        if r["bu"] != UNCLASSIFIED:
            acc[r["bu"]] += 1
    return sorted(
        [{"bu": bu, "count": count} for bu, count in acc.items()],
        key=lambda x: x["count"],
        reverse=True,
    )


class PmpService:

    @staticmethod
    def get_calendar(year: int, month: int) -> dict:
        rows   = _fetch_year_rows(year)
        prefix = f"{year:04d}-{month:02d}"
        events = [r for r in rows if r["due_date"][:7] == prefix]

        by_month = []
        for m in range(1, 13):
            m_prefix = f"{year:04d}-{m:02d}"
            by_month.append({
                "month": m,
                "count": sum(1 for r in rows if r["due_date"][:7] == m_prefix),
            })

        day_acc: dict = {}
        for r in events:
            day = r["due_date"][:10]
            if day not in day_acc:
                day_acc[day] = {"date": day, "count": 0, "by_bu": defaultdict(int)}
            day_acc[day]["count"] += 1
            day_acc[day]["by_bu"][r["bu"]] += 1

        days = [
            {"date": d["date"], "count": d["count"], "by_bu": dict(d["by_bu"])}
            for d in sorted(day_acc.values(), key=lambda x: x["date"])
        ]

        completed = sum(1 for r in events if "complet" in (r["status"] or "").lower())

        return {
            "year":  year,
            "month": month,
            "days_in_month": calendar.monthrange(year, month)[1],
            "kpis": {
                "total_year":          len(rows),
                "total_month":         len(events),
                "completed_month":     completed,
                "pending_month":       len(events) - completed,
                "unclassified_month":  sum(1 for r in events if r["bu"] == UNCLASSIFIED),
                "by_month":            by_month,
                "by_bu_month":         _count_by_bu(events),
                "by_bu_year":          _count_by_bu(rows),
            },
            "days":   days,
            "events": events,
        }