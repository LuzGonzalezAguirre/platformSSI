# apps/quality/services/incoming_inspection_dashboard_service.py
"""
Series agregadas del dashboard de Incoming Inspection.

Toda la agregación ocurre aquí, en Python, sobre datos ya materializados en
Postgres. El frontend recibe series listas para graficar — nunca filas crudas
para agregar en el navegador.
"""
from collections import defaultdict

from django.utils import timezone

from apps.quality.repositories import incoming_inspection_postgres_repository as repo
from apps.quality.services import incoming_inspection_kpi_service as kpi_service
from apps.quality.services.incoming_inspection_sla_buckets import (
    build_buckets,
    bucket_key,
    percentile,
)

REJECTED_STATUS = "Hold"
TOP_PARTS_LIMIT = 10


def _local_date(value):
    if timezone.is_naive(value):
        return value.date()
    return timezone.localtime(value).date()


def _closing_events(filters: dict) -> list[dict]:
    return list(
        repo.latest_inspection_event_queryset(filters).values(
            "serial_no", "part_no", "change_date", "container_status"
        )
    )


def build_daily_trend(rows: list[dict]) -> list[dict]:
    buckets = defaultdict(lambda: {"inspected": 0, "rejected": 0})
    for row in rows:
        bucket = buckets[_local_date(row["change_date"]).isoformat()]
        bucket["inspected"] += 1
        if row["container_status"] == REJECTED_STATUS:
            bucket["rejected"] += 1

    return [
        {
            "date": day,
            "inspected": value["inspected"],
            "accepted": value["inspected"] - value["rejected"],
            "rejected": value["rejected"],
            "rejection_rate": round(value["rejected"] / value["inspected"] * 100, 2)
            if value["inspected"] else 0.0,
        }
        for day, value in sorted(buckets.items())
    ]


def build_top_rejected_parts(rows: list[dict], limit: int = TOP_PARTS_LIMIT) -> list[dict]:
    aggregated = defaultdict(lambda: {"total": 0, "rejected": 0})
    for row in rows:
        bucket = aggregated[row["part_no"]]
        bucket["total"] += 1
        if row["container_status"] == REJECTED_STATUS:
            bucket["rejected"] += 1

    parts = [
        {
            "part_no": part_no,
            "total": value["total"],
            "rejected": value["rejected"],
            "rejection_rate": round(value["rejected"] / value["total"] * 100, 2)
            if value["total"] else 0.0,
        }
        for part_no, value in aggregated.items()
        if value["rejected"] > 0
    ]
    parts.sort(key=lambda row: (-row["rejected"], -row["rejection_rate"], row["part_no"]))
    return parts[:limit]


def build_cycle_time_histogram(sla: dict) -> dict:
    threshold_hours = sla["threshold_hours"]
    hours = sorted(entry["hours"] for entry in sla["detail"])

    buckets = build_buckets(threshold_hours)
    counts = {bucket["key"]: 0 for bucket in buckets}
    for value in hours:
        counts[bucket_key(value, threshold_hours)] += 1

    return {
        "threshold_hours": threshold_hours,
        "total": len(hours),
        "buckets": [{**bucket, "count": counts[bucket["key"]]} for bucket in buckets],
        "p50": percentile(hours, 0.5),
        "p90": percentile(hours, 0.9),
        "avg": round(sum(hours) / len(hours), 2) if hours else None,
    }


def get_dashboard(filters: dict) -> dict:
    """
    sla_status se descarta a propósito: el dashboard describe la población
    completa del rango. Filtrar el universo por el mismo indicador que se
    está midiendo produce gráficas que siempre muestran 100%.
    """
    base_filters = {k: v for k, v in filters.items() if k != "sla_status"}

    rows = _closing_events(base_filters)
    sla = kpi_service.get_sla_compliance(base_filters)

    return {
        "kpis": {
            "operation_counts": kpi_service.get_operation_counts(base_filters),
            "lots_inspected": kpi_service.get_lots_inspected(base_filters),
            "acceptance_rate": kpi_service.get_acceptance_rate(base_filters),
            "sla_compliance": {k: v for k, v in sla.items() if k != "detail"},
        },
        "daily_trend": build_daily_trend(rows),
        "top_rejected_parts": build_top_rejected_parts(rows),
        "cycle_time_histogram": build_cycle_time_histogram(sla),
    }