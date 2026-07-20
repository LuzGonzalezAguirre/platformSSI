# apps/quality/repositories/incoming_inspection_postgres_repository.py
"""
Queries del dashboard de Incoming Inspection contra Postgres local.
Ningún acceso a Plex aquí — eso vive exclusivamente en
incoming_inspection_plex_repository.py, llamado solo desde apps.quality.tasks.
"""
from apps.quality.models import IncomingContainerSnapshot, IncomingContainerHistory

INSPECTION_OPS = (11, 20)


def _apply_history_filters(qs, filters: dict):
    if filters.get("date_from"):
        qs = qs.filter(change_date__gte=filters["date_from"])
    if filters.get("date_to"):
        qs = qs.filter(change_date__lte=filters["date_to"])
    if filters.get("part_no"):
        qs = qs.filter(part_no=filters["part_no"])
    if filters.get("operation_no"):
        qs = qs.filter(operation_no=filters["operation_no"])
    if filters.get("location"):
        qs = qs.filter(location=filters["location"])
    if filters.get("container_status"):
        qs = qs.filter(container_status=filters["container_status"])
    if filters.get("defect_type"):
        qs = qs.filter(defect_type=filters["defect_type"])
    return qs


def snapshot_queryset(filters: dict):
    qs = IncomingContainerSnapshot.objects.filter(active=True)
    if filters.get("part_no"):
        qs = qs.filter(part_no=filters["part_no"])
    if filters.get("operation_no"):
        qs = qs.filter(operation_no=filters["operation_no"])
    if filters.get("location"):
        qs = qs.filter(location=filters["location"])
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
