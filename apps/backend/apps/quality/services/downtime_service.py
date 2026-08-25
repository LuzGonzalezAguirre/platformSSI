# apps/quality/services/downtime_service.py
import logging
from datetime import date, datetime, timedelta
from typing import Optional
from django.core.cache import cache
from apps.quality.services import downtime_repository
from apps.quality.services import downtime_assignment_resolver
from apps.quality.services import downtime_workcenter_service
from apps.ssi_common.filters.base import FilterContext
from apps.ssi_common.filters.shift_calendar import ShiftCalendarResolver
from apps.ssi_common.bu_classification import (
    CUSTOMER_DISPLAY_ORDER,
    CUSTOMER_VOLVO,
    CUSTOMER_CUMMINS,
    CUSTOMER_JOHN_DEERE,
    CUSTOMER_TULC,
    resolve_customer_from_workcenter,
)

logger = logging.getLogger(__name__)

CACHE_TTL_SECONDS = 10 * 60  # 10 minutos, convención del proyecto
TREND_CACHE_TTL_SECONDS = 10 * 60

FIXED_REASON = "Quality"
FIXED_STATUS = "Down"
UNCLASSIFIED_CUSTOMER = "Sin clasificar"

# El filtro estándar (FilterChoicesView) usa códigos de BusinessUnit, pero
# este módulo clasifica por CLIENTE (resolve_customer_from_workcenter), no
# por BU -- son dos sistemas distintos en el proyecto. Este mapeo traduce
# uno al otro. A diferencia de Work Requests, JOHN_DEERE SÍ se clasifica
# correctamente aquí, porque resolve_customer_from_workcenter ya lo sabe
# resolver (grupo "Speed" -> cliente John Deere).
BU_CODE_TO_CUSTOMER = {
    "VOLVO": CUSTOMER_VOLVO,
    "CUMMINS": CUSTOMER_CUMMINS,
    "TULC": CUSTOMER_TULC,
    "JOHN_DEERE": CUSTOMER_JOHN_DEERE,
}


class DowntimeServiceError(Exception):
    pass


def _cached_raw_logs(date_from: date, date_to: date) -> list[dict]:
    """
    ÚNICA parte cacheada: logs crudos de Plex, ya normalizados, filtrados
    a Status=Down y Reason=Quality -- pero SIN agrupar por fecha/workcenter
    y SIN filtrar por bu/workcenter/shift. Esos filtros dependen de la
    selección del usuario y se aplican después, en memoria, para no
    fragmentar el cache en una entrada por cada combinación de filtros
    (misma regla que Work Requests).
    """
    cache_key = f"downtime:raw:v1:{date_from.isoformat()}:{date_to.isoformat()}"
    cached = cache.get(cache_key)
    if cached is not None:
        return cached

    try:
        raw_logs = downtime_repository.fetch_logs(date_from, date_to, reason=FIXED_REASON)
    except downtime_repository.DowntimeRepositoryError as exc:
        raise DowntimeServiceError(str(exc)) from exc

    normalized = []
    for row in raw_logs:
        if row.get("Status") != FIXED_STATUS:
            continue
        log_date_raw = row.get("Log_Date")
        workcenter = row.get("Workcenter")
        if not log_date_raw or not workcenter:
            continue
        normalized.append(_normalize_log(row))

    cache.set(cache_key, normalized, CACHE_TTL_SECONDS)
    return normalized


def _matches_filters(row: dict, filter_ctx: FilterContext, group_map: dict) -> bool:
    if filter_ctx.workcenter and row["workcenter"] not in filter_ctx.workcenter:
        return False

    if filter_ctx.bu:
        customer = resolve_customer_from_workcenter(
            group_map.get(row["workcenter"]), row["workcenter"],
        )
        wanted_customers = {
            BU_CODE_TO_CUSTOMER[code] for code in filter_ctx.bu if code in BU_CODE_TO_CUSTOMER
        }
        if wanted_customers and customer not in wanted_customers:
            return False

    if filter_ctx.shift:
        try:
            log_dt = datetime.fromisoformat(str(row["log_date"])[:19])
        except (ValueError, TypeError):
            return False
        if not ShiftCalendarResolver.matches(log_dt, filter_ctx.shift):
            return False

    return True


def _aggregate(rows: list[dict]) -> list[dict]:
    grouped: dict[tuple[str, str], dict] = {}
    for row in rows:
        day_key = str(row["log_date"])[:10]
        workcenter = row["workcenter"]
        key = (day_key, workcenter)
        bucket = grouped.setdefault(key, {"total_hours": 0.0, "incident_count": 0})
        bucket["total_hours"] += float(row.get("log_hours") or 0)
        bucket["incident_count"] += 1

    aggregation = [
        {
            "date": day_key,
            "workcenter": workcenter,
            "total_minutes": round(agg["total_hours"] * 60),
            "incident_count": agg["incident_count"],
        }
        for (day_key, workcenter), agg in grouped.items()
    ]
    aggregation.sort(key=lambda r: (r["date"], r["workcenter"]))
    return aggregation


def _bucket_by_customer(aggregation: list[dict], group_map: dict) -> list[dict]:
    buckets: dict[str, dict] = {}
    unknown_workcenters: set[str] = set()

    for item in aggregation:
        workcenter = item["workcenter"]
        customer = resolve_customer_from_workcenter(
            group_map.get(workcenter), workcenter,
        )
        if customer is None:
            customer = UNCLASSIFIED_CUSTOMER
            unknown_workcenters.add(workcenter)

        bucket = buckets.setdefault(customer, {
            "total_minutes": 0, "incident_count": 0, "workcenters": set(),
        })
        bucket["total_minutes"] += item["total_minutes"]
        bucket["incident_count"] += item["incident_count"]
        bucket["workcenters"].add(workcenter)

    if unknown_workcenters:
        logger.warning(
            "downtime by_customer: %s workcenters sin cliente resuelto: %s",
            len(unknown_workcenters), sorted(unknown_workcenters),
        )

    total_minutes = sum(b["total_minutes"] for b in buckets.values())

    ordered = list(CUSTOMER_DISPLAY_ORDER)
    if UNCLASSIFIED_CUSTOMER in buckets:
        ordered.append(UNCLASSIFIED_CUSTOMER)

    rows = []
    for customer in ordered:
        bucket = buckets.get(customer)
        minutes = bucket["total_minutes"] if bucket else 0
        rows.append({
            "customer": customer,
            "total_minutes": minutes,
            "total_hours": round(minutes / 60, 2),
            "incident_count": bucket["incident_count"] if bucket else 0,
            "workcenter_count": len(bucket["workcenters"]) if bucket else 0,
            "share_pct": round(minutes / total_minutes * 100, 1) if total_minutes else 0.0,
        })
    return rows


def get_logs(filter_ctx: FilterContext) -> dict:
    raw_logs = _cached_raw_logs(filter_ctx.start_date, filter_ctx.end_date)
    group_map = downtime_workcenter_service.get_workcenter_group_map()

    filtered = [r for r in raw_logs if _matches_filters(r, filter_ctx, group_map)]
    total_hours = sum(float(r["log_hours"] or 0) for r in filtered)

    return {
        "date_from": filter_ctx.start_date.isoformat(),
        "date_to": filter_ctx.end_date.isoformat(),
        "count": len(filtered),
        "total_hours": round(total_hours, 2),
        "results": filtered,
    }


def get_summary(filter_ctx: FilterContext) -> dict:
    """
    Minutos + incidencias por (fecha, workcenter), con el inspector efectivo
    de ese día resuelto por jerarquía scope + herencia.

    Inspector se resuelve fuera del cache de logs (Postgres, barato) --
    un cambio de inspector se ve al instante, sin esperar el TTL del cache
    de Plex. bu/workcenter/shift se aplican en memoria sobre los logs
    crudos ya cacheados, antes de agregar.
    """
    raw_logs = _cached_raw_logs(filter_ctx.start_date, filter_ctx.end_date)
    group_map = downtime_workcenter_service.get_workcenter_group_map()

    filtered = [r for r in raw_logs if _matches_filters(r, filter_ctx, group_map)]
    aggregation = _aggregate(filtered)

    resolution = downtime_assignment_resolver.resolve_range_by_iso(
        filter_ctx.start_date, filter_ctx.end_date,
    )

    rows = []
    for item in aggregation:
        resolved = resolution.get((item["date"], item["workcenter"]))
        rows.append({
            **item,
            "inspector_name": resolved["inspector_name"] if resolved else None,
            "inspector_inherited_from": resolved["inherited_from"] if resolved else None,
        })

    return {
        "date_from": filter_ctx.start_date.isoformat(),
        "date_to": filter_ctx.end_date.isoformat(),
        "rows": rows,
        "by_customer": _bucket_by_customer(aggregation, group_map),
    }


def get_trend(
    granularity: str = "daily",
    end_date: Optional[date] = None,
    buckets: int = 6,
) -> dict:
    """Sin cambios -- fuera de alcance de esta estandarización (ver PM Program:
    mismo criterio, granularity/end_date es un paradigma distinto a rango)."""
    if granularity not in ("daily", "week", "month"):
        raise DowntimeServiceError(f"Granularidad no soportada: {granularity}")

    ref_date = end_date or date.today()

    if granularity == "daily":
        date_from = ref_date - timedelta(days=buckets - 1)
        date_to = ref_date
        bucket_bounds = [
            (d, d, d.isoformat())
            for d in (date_from + timedelta(days=i) for i in range(buckets))
        ]
    elif granularity == "week":
        current_week_start = ref_date - timedelta(days=ref_date.weekday())
        first_week_start = current_week_start - timedelta(weeks=buckets - 1)
        date_from = first_week_start
        date_to = min(current_week_start + timedelta(days=6), date.today())
        bucket_bounds = []
        for i in range(buckets):
            w_start = first_week_start + timedelta(weeks=i)
            w_end = w_start + timedelta(days=6)
            bucket_bounds.append((w_start, w_end, w_start.isoformat()))
    else:  # month
        ref_month_start = ref_date.replace(day=1)
        first_month_start = _shift_months(ref_month_start, -(buckets - 1))
        date_from = first_month_start
        date_to = min(_month_end(ref_month_start), date.today())
        bucket_bounds = []
        for i in range(buckets):
            m_start = _shift_months(first_month_start, i)
            m_end = _month_end(m_start)
            bucket_bounds.append((m_start, m_end, m_start.isoformat()[:7]))

    cache_key = f"downtime:trend:v3:{granularity}:{date_from.isoformat()}:{date_to.isoformat()}"
    cached = cache.get(cache_key)
    if cached is not None:
        return cached

    try:
        raw_logs = downtime_repository.fetch_logs(date_from, date_to, reason=FIXED_REASON)
    except downtime_repository.DowntimeRepositoryError as exc:
        raise DowntimeServiceError(str(exc)) from exc

    filtered = []
    for row in raw_logs:
        if row.get("Status") != FIXED_STATUS:
            continue
        log_date_raw = row.get("Log_Date")
        if not log_date_raw:
            continue
        try:
            day = date.fromisoformat(str(log_date_raw)[:10])
        except ValueError:
            continue
        filtered.append((day, float(row.get("Log_Hours") or 0)))

    points = []
    for b_start, b_end, label in bucket_bounds:
        bucket_hours = sum(h for d, h in filtered if b_start <= d <= b_end)
        bucket_count = sum(1 for d, _ in filtered if b_start <= d <= b_end)
        points.append({
            "date": label,
            "total_hours": round(bucket_hours, 2),
            "incident_count": bucket_count,
        })

    result = {
        "granularity": granularity,
        "date_from": date_from.isoformat(),
        "date_to": date_to.isoformat(),
        "points": points,
    }
    cache.set(cache_key, result, TREND_CACHE_TTL_SECONDS)
    return result


def _shift_months(d: date, delta: int) -> date:
    total = d.year * 12 + (d.month - 1) + delta
    year, month = divmod(total, 12)
    return date(year, month + 1, 1)


def _month_end(month_start: date) -> date:
    next_month = _shift_months(month_start, 1)
    return next_month - timedelta(days=1)


def _normalize_log(row: dict) -> dict:
    """Traduce las llaves PascalCase del proxy (alias SQL) a snake_case."""
    return {
        "log_date": row.get("Log_Date"),
        "log_hours": row.get("Log_Hours"),
        "status": row.get("Status"),
        "reason": row.get("Reason"),
        "notes": row.get("Notes"),
        "workcenter": row.get("Workcenter"),
        "shift": row.get("Shift"),
        "part_no": row.get("Part_No"),
        "operation_no": row.get("Operation_No"),
        "operation_description": row.get("Operation_Description"),
        "job_no": row.get("Job_No"),
    }