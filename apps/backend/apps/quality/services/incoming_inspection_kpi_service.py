# apps/quality/services/incoming_inspection_kpi_service.py
from django.db.models import Count, Sum, Min, Window, Case, When, Value, CharField
from django.db.models.functions import RowNumber

from apps.quality.repositories import incoming_inspection_postgres_repository as repo
from apps.quality.services.incoming_inspection_sla_config_service import get_current_threshold

REJECTED_STATUS = "Hold"

OPERATION_NAMES = {
    10: "Receive-Each",
    11: "Inspect-Each",
    20: "Inspect-Each",
}


def _is_rejected(container_status: str | None) -> bool:
    if not container_status:
        return False
    return container_status == REJECTED_STATUS


def get_operation_counts(filters: dict) -> list[dict]:
    qs = repo.history_queryset(filters, operation_nos=(10, 11, 20)).annotate(
        operation_name=Case(
            When(operation_no=10, then=Value(OPERATION_NAMES[10])),
            When(operation_no__in=[11, 20], then=Value(OPERATION_NAMES[11])),
            default=Value("Unknown"),
            output_field=CharField(),
        )
    )
    rows = (
        qs.values("operation_name")
        .annotate(lot_count=Count("serial_no", distinct=True))
        .order_by("operation_name")
    )
    return [
        {
            "operation_key": "10" if row["operation_name"] == OPERATION_NAMES[10] else "11_20",
            "operation_name": row["operation_name"],
            "lot_count": row["lot_count"],
        }
        for row in rows
    ]


def get_lots_inspected(filters: dict) -> dict:
    qs = repo.history_queryset(filters)
    total = qs.values("serial_no").distinct().count()
    by_operation = list(
        qs.values("operation_no")
        .annotate(count=Count("serial_no", distinct=True))
        .order_by("operation_no")
    )
    return {"total": total, "by_operation": by_operation}


def get_acceptance_rate(filters: dict) -> dict:
    qs = repo.history_queryset(filters).annotate(
        row_number=Window(
            expression=RowNumber(),
            partition_by=["serial_no"],
            order_by=["-change_date"],
        )
    )
    latest_rows = qs.filter(row_number=1)

    total = 0
    rejected = 0
    for row in latest_rows.values("container_status"):
        total += 1
        if _is_rejected(row["container_status"]):
            rejected += 1

    accepted = total - rejected
    acceptance_rate = round((accepted / total) * 100, 2) if total else 0.0
    return {"total": total, "accepted": accepted, "rejected": rejected, "acceptance_rate": acceptance_rate}


def get_rejected_lots_queryset(filters: dict):
    """
    Pestaña "Lotes Rechazados" — mismo criterio deduplicado (Window/RowNumber
    sobre último estado por serial_no) que get_acceptance_rate(), expuesto
    aquí como queryset paginable en vez de agregado.

    Se ignora cualquier filtro de container_status recibido — esta vista
    SIEMPRE es "solo Hold" por definición, sin importar qué filtro haya
    quedado seleccionado en la pestaña de Resumen.
    """
    rejected_filters = {k: v for k, v in filters.items() if k != "container_status"}
    qs = repo.history_queryset(rejected_filters).annotate(
        row_number=Window(
            expression=RowNumber(),
            partition_by=["serial_no"],
            order_by=["-change_date"],
        )
    )
    return qs.filter(row_number=1, container_status=REJECTED_STATUS).order_by("-change_date")


def get_sla_compliance(filters: dict) -> dict:
    threshold_hours = get_current_threshold()

    ends = {
        row["serial_no"]: row["end"]
        for row in repo.history_queryset(filters)
        .values("serial_no")
        .annotate(end=Min("change_date"))
    }

    starts_filters = {k: v for k, v in filters.items() if k not in ("date_from", "date_to")}
    starts = {
        row["serial_no"]: row["start"]
        for row in repo.op10_start_queryset(starts_filters)
        .filter(serial_no__in=list(ends.keys()))
        .values("serial_no")
        .annotate(start=Min("change_date"))
    }

    on_time = 0
    late = 0
    detail = []
    for serial_no, end in ends.items():
        start = starts.get(serial_no)
        if start is None:
            continue
        hours = (end - start).total_seconds() / 3600
        is_on_time = hours <= threshold_hours
        if is_on_time:
            on_time += 1
        else:
            late += 1
        detail.append({
            "serial_no": serial_no,
            "start": start,
            "end": end,
            "hours": round(hours, 2),
            "sla_status": "on_time" if is_on_time else "late",
        })

    sla_status = filters.get("sla_status")
    if sla_status:
        detail = [d for d in detail if d["sla_status"] == sla_status]

    total = on_time + late
    return {
        "threshold_hours": threshold_hours,
        "on_time": on_time,
        "late": late,
        "compliance_rate": round((on_time / total) * 100, 2) if total else 0.0,
        "detail": detail,
    }


def get_detail_queryset(filters: dict, ordering: str = "-change_date"):
    return repo.history_queryset(filters).order_by(ordering)