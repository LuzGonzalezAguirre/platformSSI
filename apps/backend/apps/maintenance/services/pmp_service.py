import calendar
import os
from collections import defaultdict

import requests
from django.core.cache import cache
from django.utils import timezone

from apps.ssi_common.bu_classification import resolve_bu_from_workcenter

PROXY_URL    = os.getenv("PLEX_PROXY_URL", "http://host.docker.internal:8001")
PROXY_SECRET = os.getenv("PLEX_PROXY_SECRET", "")
HEADERS      = {"Authorization": f"Bearer {PROXY_SECRET}"}

PM_TYPE_KEY   = int(os.getenv("PLEX_PM_TYPE_KEY", "1908"))
CACHE_VERSION = "v2"
CACHE_TTL     = 600

UNCLASSIFIED = "unclassified"

STATUS_COMPLETE  = "complete"
STATUS_OPEN      = "open"
STATUS_HOLD      = "hold"
STATUS_CANCELLED = "cancelled"

ALL_BUCKET = "all"


class PmpServiceError(Exception):
    """Fallo al obtener el programa de mantenimiento preventivo desde Plex."""


def normalize_status(raw: str | None) -> str:
    """
    Fuente de verdad del mapeo de estados. Plex regresa Complete / Open /
    Hold / Cancelled; cualquier valor desconocido cae a "open" para que
    aparezca como pendiente en vez de desaparecer del conteo.
    """
    s = (raw or "").lower()
    if "cancel" in s:
        return STATUS_CANCELLED
    if "complet" in s:
        return STATUS_COMPLETE
    if "hold" in s:
        return STATUS_HOLD
    return STATUS_OPEN


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
        row["bu"]          = bu or UNCLASSIFIED
        row["status_norm"] = normalize_status(row.get("status"))

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


def _empty_stats() -> dict:
    return {
        "total":        0,
        "cancelled":    0,
        "active":       0,
        "complete":     0,
        "hold":         0,
        "open":         0,
        "due_active":   0,
        "due_complete": 0,
        "overdue":      0,
        "plan_pct":     None,
        "ytd_pct":      None,
    }


def _accumulate(bucket: dict, row: dict, today_iso: str) -> None:
    status = row["status_norm"]
    bucket["total"] += 1

    if status == STATUS_CANCELLED:
        bucket["cancelled"] += 1
        return

    bucket["active"] += 1
    bucket[status]   += 1

    if row["due_date"][:10] <= today_iso:
        bucket["due_active"] += 1
        if status == STATUS_COMPLETE:
            bucket["due_complete"] += 1
        else:
            bucket["overdue"] += 1


def _finalize(bucket: dict) -> dict:
    bucket["plan_pct"] = (
        round(bucket["complete"] / bucket["active"] * 100, 1)
        if bucket["active"] else None
    )
    bucket["ytd_pct"] = (
        round(bucket["due_complete"] / bucket["due_active"] * 100, 1)
        if bucket["due_active"] else None
    )
    return bucket


def _year_stats(rows: list[dict], today_iso: str) -> dict:
    """
    Dos métricas deliberadamente separadas:

      plan_pct -> avance sobre el plan anual COMPLETO (incluye PM que aún
                  no vencen). Mide ejecución acumulada del año.
      ytd_pct  -> cumplimiento sobre lo que YA venció. Es el KPI real de
                  schedule compliance de mantenimiento.

    Los cancelados salen del denominador en ambas: no son incumplimiento.
    Un año futuro regresa ytd_pct = None (no hay base vencida), no 0.
    """
    stats: dict = {ALL_BUCKET: _empty_stats()}

    for row in rows:
        key = (row["bu"] or UNCLASSIFIED).lower()
        if key not in stats:
            stats[key] = _empty_stats()
        _accumulate(stats[ALL_BUCKET], row, today_iso)
        _accumulate(stats[key],        row, today_iso)

    return {k: _finalize(v) for k, v in stats.items()}


def _by_month(rows: list[dict], year: int) -> list[dict]:
    acc = {
        m: {"month": m, "count": 0, "active": 0, "complete": 0}
        for m in range(1, 13)
    }

    for r in rows:
        due = r["due_date"]
        if due[:4] != f"{year:04d}":
            continue
        m = int(due[5:7])
        entry = acc[m]
        entry["count"] += 1
        if r["status_norm"] == STATUS_CANCELLED:
            continue
        entry["active"] += 1
        if r["status_norm"] == STATUS_COMPLETE:
            entry["complete"] += 1

    out = []
    for m in range(1, 13):
        e = acc[m]
        e["pct"] = (
            round(e["complete"] / e["active"] * 100, 1) if e["active"] else None
        )
        out.append(e)
    return out


class PmpService:

    @staticmethod
    def get_calendar(year: int, month: int) -> dict:
        rows      = _fetch_year_rows(year)
        today_iso = timezone.localdate().isoformat()

        prefix = f"{year:04d}-{month:02d}"
        events = [r for r in rows if r["due_date"][:7] == prefix]

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

        completed = sum(1 for r in events if r["status_norm"] == STATUS_COMPLETE)

        return {
            "year":  year,
            "month": month,
            "days_in_month": calendar.monthrange(year, month)[1],
            "as_of": today_iso,
            "kpis": {
                "total_year":          len(rows),
                "total_month":         len(events),
                "completed_month":     completed,
                "pending_month":       len(events) - completed,
                "unclassified_month":  sum(1 for r in events if r["bu"] == UNCLASSIFIED),
                "by_month":            _by_month(rows, year),
                "by_bu_month":         _count_by_bu(events),
                "by_bu_year":          _count_by_bu(rows),
                "year_stats":          _year_stats(rows, today_iso),
            },
            "days":   days,
            "events": events,
        }