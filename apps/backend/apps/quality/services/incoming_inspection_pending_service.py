# apps/quality/services/incoming_inspection_pending_service.py
"""
Backlog operativo de Op 10: contenedores recibidos cuyo último evento en el
historial sigue siendo el recibo, es decir, pendientes por inspeccionar.

Fuente: IncomingContainerHistory (única que permite calcular antigüedad).
IncomingContainerSnapshot se usa SOLO para conciliar totales y detectar
pérdida silenciosa de eventos en el sync incremental.
"""
from django.utils import timezone

from apps.quality.repositories import incoming_inspection_postgres_repository as repo
from apps.quality.services.incoming_inspection_sla_config_service import get_current_threshold
from apps.quality.services.incoming_inspection_sla_buckets import (
    build_buckets,
    bucket_key,
)

MAX_PENDING_ROWS = 2000
DRIFT_TOLERANCE_PCT = 10

ROW_FIELDS = (
    "id", "serial_no", "part_no", "operation_no", "change_date",
    "last_action", "location", "container_status", "defect_type",
    "note", "change_by",
)


def _as_aware(value):
    if timezone.is_naive(value):
        return timezone.make_aware(value, timezone.get_current_timezone())
    return value


def _reconciliation(history_total: int, filters: dict) -> dict:
    """
    Conciliación agregada historial vs snapshot. No identifica el lote
    específico en discrepancia — para eso haría falta serial_no en el
    snapshot (ver nota de arquitectura). Sí detecta que el sync incremental
    está perdiendo eventos, que es el modo de falla real.
    """
    snapshot = repo.snapshot_op10_summary(filters)
    synced_at = snapshot.get("synced_at")

    if synced_at is None:
        return {
            "status": "no_snapshot",
            "snapshot_total": None,
            "history_total": history_total,
            "delta": None,
            "snapshot_quantity": None,
            "snapshot_synced_at": None,
        }

    snapshot_total = snapshot.get("container_count") or 0
    delta = history_total - snapshot_total
    tolerance = max(1.0, snapshot_total * DRIFT_TOLERANCE_PCT / 100)

    return {
        "status": "ok" if abs(delta) <= tolerance else "drift",
        "snapshot_total": snapshot_total,
        "history_total": history_total,
        "delta": delta,
        "snapshot_quantity": snapshot.get("quantity"),
        "snapshot_synced_at": synced_at,
    }


def get_pending_backlog(filters: dict) -> dict:
    threshold_hours = get_current_threshold()
    now = timezone.now()

    base = repo.pending_op10_queryset(filters)
    history_total_all_dates = base.count()

    scoped = repo.apply_date_filters(base, filters).order_by("change_date")
    raw = list(scoped.values(*ROW_FIELDS)[: MAX_PENDING_ROWS + 1])
    truncated = len(raw) > MAX_PENDING_ROWS
    raw = raw[:MAX_PENDING_ROWS]

    rows = []
    for record in raw:
        received_at = _as_aware(record["change_date"])
        waiting_hours = round((now - received_at).total_seconds() / 3600, 2)
        rows.append({
            **record,
            "waiting_hours": waiting_hours,
            "aging_bucket": bucket_key(waiting_hours, threshold_hours),
            "sla_status": "late" if waiting_hours > threshold_hours else "on_time",
        })

    sla_status_filter = filters.get("sla_status")
    if sla_status_filter:
        rows = [r for r in rows if r["sla_status"] == sla_status_filter]

    buckets = build_buckets(threshold_hours)
    counts = {bucket["key"]: 0 for bucket in buckets}
    for row in rows:
        counts[row["aging_bucket"]] += 1

    waiting_values = [row["waiting_hours"] for row in rows]
    on_time = sum(1 for row in rows if row["sla_status"] == "on_time")

    return {
        "threshold_hours": threshold_hours,
        "generated_at": now,
        "count": len(rows),
        "truncated": truncated,
        "summary": {
            "total": len(rows),
            "on_time": on_time,
            "late": len(rows) - on_time,
            "oldest_hours": max(waiting_values) if waiting_values else None,
            "avg_hours": round(sum(waiting_values) / len(waiting_values), 2) if waiting_values else None,
            "buckets": [{**bucket, "count": counts[bucket["key"]]} for bucket in buckets],
        },
        "reconciliation": _reconciliation(history_total_all_dates, filters),
        "results": rows,
    }