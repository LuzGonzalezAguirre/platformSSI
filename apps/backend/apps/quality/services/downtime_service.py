# apps/quality/services/downtime_service.py
import logging
from datetime import date, timedelta
from typing import Optional
from django.core.cache import cache
from apps.quality.services import downtime_repository
from apps.quality.services import downtime_assignment_resolver
from apps.quality.services import downtime_workcenter_service
from apps.ssi_common.bu_classification import (
    CUSTOMER_DISPLAY_ORDER,
    resolve_customer_from_workcenter,
)
logger = logging.getLogger(__name__)

CACHE_TTL_SECONDS = 10 * 60  # 10 minutos, convención del proyecto
TREND_CACHE_TTL_SECONDS = 10 * 60

# Filtro fijo: este módulo vive dentro de Quality y solo debe mostrar
# downtime cuyo Reason en Plex sea 'Quality'. Si en el futuro Maintenance
# necesita ver el resto de razones, eso debe ser un endpoint/vista aparte,
# no un parámetro configurable aquí.
FIXED_REASON = "Quality"
# Solo Down — Setup queda excluido aunque el proxy traiga ambos (5445/5449).
FIXED_STATUS = "Down"
UNCLASSIFIED_CUSTOMER = "Sin clasificar"

class DowntimeServiceError(Exception):
    pass


def resolve_date_range(
    preset: str,
    date_from: Optional[date] = None,
    date_to: Optional[date] = None,
    today: Optional[date] = None,
) -> tuple[date, date]:
    """
    Asume semana Lunes-a-hoy y mes Día1-a-hoy — AJUSTAR si tu criterio de
    "semana"/"mes" es distinto. 'today' se puede inyectar para tests.
    """
    today = today or date.today()

    if preset == "today":
        return today, today
    elif preset == "yesterday":
        yesterday = today - timedelta(days=1)
        return yesterday, yesterday
    elif preset == "this_week":
        monday = today - timedelta(days=today.weekday())
        return monday, today
    elif preset == "this_month":
        return today.replace(day=1), today
    elif preset == "custom":
        if not date_from or not date_to:
            raise DowntimeServiceError(
                "date_from y date_to son obligatorios cuando preset=custom."
            )
        if date_from > date_to:
            raise DowntimeServiceError("date_from no puede ser posterior a date_to.")
        return date_from, date_to
    else:
        raise DowntimeServiceError(f"Preset no soportado: {preset}")


def get_logs(
    preset: str,
    date_from: Optional[date] = None,
    date_to: Optional[date] = None,
) -> dict:
    resolved_from, resolved_to = resolve_date_range(preset, date_from, date_to)

    cache_key = f"downtime:logs:v2:{resolved_from.isoformat()}:{resolved_to.isoformat()}"
    cached = cache.get(cache_key)
    if cached is not None:
        return cached

    try:
        raw_logs = downtime_repository.fetch_logs(resolved_from, resolved_to, reason=FIXED_REASON)
    except downtime_repository.DowntimeRepositoryError as exc:
        raise DowntimeServiceError(str(exc)) from exc

    normalized = [_normalize_log(row) for row in raw_logs if row.get("Status") == FIXED_STATUS]
    total_hours = sum(float(r["log_hours"] or 0) for r in normalized)

    result = {
        "date_from": resolved_from.isoformat(),
        "date_to": resolved_to.isoformat(),
        "count": len(normalized),
        "total_hours": round(total_hours, 2),
        "results": normalized,
    }
    cache.set(cache_key, result, CACHE_TTL_SECONDS)
    return result


def _cached_plex_aggregation(resolved_from: date, resolved_to: date) -> list[dict]:
    """
    ÚNICA parte cacheada: la agregación de Plex por (fecha, workcenter).
    Una sola llamada ODBC por rango, bucketing en Python (ERP Protection Rule).

    El inspector NO entra aquí a propósito — ver get_summary().
    """
    cache_key = f"downtime:agg:v3:{resolved_from.isoformat()}:{resolved_to.isoformat()}"
    cached = cache.get(cache_key)
    if cached is not None:
        return cached

    try:
        raw_logs = downtime_repository.fetch_logs(
            resolved_from, resolved_to, reason=FIXED_REASON,
        )
    except downtime_repository.DowntimeRepositoryError as exc:
        raise DowntimeServiceError(str(exc)) from exc

    grouped: dict[tuple[str, str], dict] = {}
    for row in raw_logs:
        if row.get("Status") != FIXED_STATUS:
            continue
        log_date_raw = row.get("Log_Date")
        workcenter = row.get("Workcenter")
        if not log_date_raw or not workcenter:
            continue
        key = (str(log_date_raw)[:10], workcenter)
        bucket = grouped.setdefault(key, {"total_hours": 0.0, "incident_count": 0})
        bucket["total_hours"] += float(row.get("Log_Hours") or 0)
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

    cache.set(cache_key, aggregation, CACHE_TTL_SECONDS)
    return aggregation

def _bucket_by_customer(aggregation: list[dict]) -> list[dict]:
    """
    Minutos y incidencias por cliente. Cruza la agregacion de Plex (que solo
    trae el nombre del workcenter) contra el catalogo local de Postgres para
    obtener el Workcenter_Group, y de ahi al cliente.

    CERO llamadas extra a Plex: el catalogo ya vive en Postgres via
    sync_workcenters. Por eso esto corre FUERA del cache de agregacion --
    la clasificacion puede cambiar con un sync o un deploy y debe reflejarse
    de inmediato, igual que la resolucion de inspectores.
    """
    group_map = downtime_workcenter_service.get_workcenter_group_map()

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
        # WARNING y no DEBUG a proposito: cada nombre en esta lista son
        # minutos de downtime que no se le estan cargando a ningun cliente.
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

def get_summary(
    preset: str,
    date_from: Optional[date] = None,
    date_to: Optional[date] = None,
) -> dict:
    """
    Minutos + incidencias por (fecha, workcenter), con el inspector efectivo
    de ese día resuelto por jerarquía scope + herencia.

    CACHE PARTIDO — deliberado:
      · agregación de Plex  → Redis 10 min  (ODBC caro, protege el ERP)
      · inspector           → Postgres live (barato, 2 queries)

    Antes ambas cosas vivían en el mismo objeto cacheado, así que un cambio
    de inspector tardaba hasta 10 minutos en verse en el reporte. Ahora se
    ve al instante sin agregarle ni una llamada a Plex.
    """
    resolved_from, resolved_to = resolve_date_range(preset, date_from, date_to)

    aggregation = _cached_plex_aggregation(resolved_from, resolved_to)
    resolution = downtime_assignment_resolver.resolve_range_by_iso(
        resolved_from, resolved_to,
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
        "date_from": resolved_from.isoformat(),
        "date_to": resolved_to.isoformat(),
        "rows": rows,
        "by_customer": _bucket_by_customer(aggregation),
    }


def get_trend(
    granularity: str = "daily",
    end_date: Optional[date] = None,
    buckets: int = 6,
) -> dict:
    """
    Serie de `buckets` puntos (día/semana/mes), cada uno = SUMA de horas
    dentro de ese bucket. El último bucket siempre incluye `end_date`
    (por default hoy) — así el trend se alinea con "hasta el último día
    consultado" en la tabla, en vez de ser siempre un rango fijo a hoy.
    Una sola llamada al proxy por rango total, agregación en Python.
    """
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
            bucket_bounds.append((m_start, m_end, m_start.isoformat()[:7]))  # YYYY-MM

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
    """d debe tener day=1. Regresa el day=1 del mes desplazado `delta` meses."""
    total = d.year * 12 + (d.month - 1) + delta
    year, month = divmod(total, 12)
    return date(year, month + 1, 1)


def _month_end(month_start: date) -> date:
    """month_start debe tener day=1. Regresa el último día de ese mes."""
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