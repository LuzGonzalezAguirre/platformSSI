# apps/quality/repositories/incoming_inspection_postgres_repository.py
"""
Queries del dashboard de Incoming Inspection contra Postgres local.
Ningún acceso a Plex aquí — eso vive exclusivamente en
incoming_inspection_plex_repository.py, llamado solo desde apps.quality.tasks.
"""
from django.db.models import Count, Max, Sum, Window
from django.db.models.functions import RowNumber

from apps.quality.models import IncomingContainerSnapshot, IncomingContainerHistory

INSPECTION_OPS = (11, 20)
ALL_OPS = (10, 11, 20)


def _apply_scope_filters(qs, filters: dict):
    if filters.get("part_no"):
        qs = qs.filter(part_no=filters["part_no"])
    if filters.get("location"):
        qs = qs.filter(location=filters["location"])
    return qs


def apply_date_filters(qs, filters: dict):
    if filters.get("date_from"):
        qs = qs.filter(change_date__gte=filters["date_from"])
    if filters.get("date_to"):
        qs = qs.filter(change_date__lte=filters["date_to"])
    return qs


def _apply_history_filters(qs, filters: dict):
    qs = apply_date_filters(qs, filters)
    qs = _apply_scope_filters(qs, filters)
    if filters.get("operation_no"):
        qs = qs.filter(operation_no=filters["operation_no"])
    if filters.get("container_status"):
        qs = qs.filter(container_status=filters["container_status"])
    if filters.get("defect_type"):
        qs = qs.filter(defect_type=filters["defect_type"])
    return qs


def snapshot_queryset(filters: dict):
    qs = IncomingContainerSnapshot.objects.filter(active=True)
    qs = _apply_scope_filters(qs, filters)
    if filters.get("operation_no"):
        qs = qs.filter(operation_no=filters["operation_no"])
    return qs


def history_queryset(filters: dict, operation_nos=INSPECTION_OPS):
    qs = IncomingContainerHistory.objects.filter(operation_no__in=operation_nos)
    return _apply_history_filters(qs, filters)


def op10_start_queryset(filters: dict):
    """Filas de arranque del SLA (op 10) — se filtran por fecha/part/location
    igual que el resto, pero nunca por operation_no (siempre es 10)."""
    op10_filters = {k: v for k, v in filters.items() if k != "operation_no"}
    qs = IncomingContainerHistory.objects.filter(operation_no=10)
    return _apply_history_filters(qs, op10_filters)


def _latest_per_serial(qs):
    return qs.annotate(
        row_number=Window(
            expression=RowNumber(),
            partition_by=["serial_no"],
            order_by=["-change_date", "-id"],
        )
    ).filter(row_number=1)


def latest_event_per_serial_queryset(filters: dict):
    """
    Último evento por serial sobre TODO el historial (ops 10/11/20), sin
    recortar por fecha.

    Recortar por fecha ANTES de la ventana produce falsos pendientes: un lote
    inspeccionado fuera del rango se vería como si su último evento fuera el
    Op 10. El recorte por fecha se aplica después, sobre el resultado.
    """
    qs = IncomingContainerHistory.objects.filter(operation_no__in=ALL_OPS)
    qs = _apply_scope_filters(qs, filters)
    return _latest_per_serial(qs)


def pending_op10_queryset(filters: dict):
    return latest_event_per_serial_queryset(filters).filter(operation_no=10)


def latest_inspection_event_queryset(filters: dict):
    """Evento de cierre de inspección por serial (último de ops 11/20).
    Misma población que get_acceptance_rate — las gráficas deben cuadrar
    con el donut, si no el usuario deja de confiar en el dashboard."""
    return _latest_per_serial(history_queryset(filters, operation_nos=INSPECTION_OPS))


def snapshot_op10_summary(filters: dict) -> dict:
    qs = IncomingContainerSnapshot.objects.filter(active=True, operation_no=10)
    qs = _apply_scope_filters(qs, filters)
    return qs.aggregate(
        container_count=Count("id"),
        quantity=Sum("quantity"),
        synced_at=Max("synced_at"),
    )