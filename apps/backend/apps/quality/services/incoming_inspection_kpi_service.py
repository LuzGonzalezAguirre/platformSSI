# apps/quality/services/incoming_inspection_kpi_service.py
from django.db.models import Count, Sum, Min, Window
from django.db.models.functions import RowNumber

from apps.quality.repositories import incoming_inspection_postgres_repository as repo
from apps.quality.services.incoming_inspection_sla_config_service import get_current_threshold

REJECTED_STATUS_MARKERS = ("reject", "fail", "scrap", "hold")


def _is_rejected(container_status: str | None) -> bool:
    if not container_status:
        return False
    status = container_status.lower()
    return any(marker in status for marker in REJECTED_STATUS_MARKERS)


def get_operation_counts(filters: dict) -> list[dict]:
    """Objetivo 1 — containers actualmente en Incoming Inspection por operación."""
    rows = (
        repo.snapshot_queryset(filters)
        .values("operation_no")
        .annotate(container_count=Count("id"), total_quantity=Sum("quantity"))
        .order_by("operation_no")
    )
    return list(rows)


def get_lots_inspected(filters: dict) -> dict:
    """Objetivo 2 — lotes inspeccionados (ops 11/20) en el rango filtrado."""
    qs = repo.history_queryset(filters)
    total = qs.count()
    by_operation = list(qs.values("operation_no").annotate(count=Count("id")).order_by("operation_no"))
    return {"total": total, "by_operation": by_operation}


def get_acceptance_rate(filters: dict) -> dict:
    """
    Objetivo 3 — % de aceptación basado en el último estado registrado
    (ops 11/20) por serial_no.

    Nota: la vocabulary exacta de `container_status` en Plex no está
    confirmada aún (ver checklist del PR) — se clasifica como "rechazado"
    cualquier status que contenga reject/fail/scrap/hold (case-insensitive);
    todo lo demás cuenta como aceptado. Ajustar REJECTED_STATUS_MARKERS
    cuando se valide contra datos reales.
    """
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


def get_sla_compliance(filters: dict) -> dict:
    """Objetivo 4 — cumplimiento del SLA de inspección (op10 -> ops 11/20)."""
    threshold_hours = get_current_threshold()

    starts = {
        row["serial_no"]: row["start"]
        for row in repo.op10_start_queryset(filters)
        .values("serial_no")
        .annotate(start=Min("change_date"))
    }
    ends = {
        row["serial_no"]: row["end"]
        for row in repo.history_queryset(filters)
        .values("serial_no")
        .annotate(end=Min("change_date"))
    }

    on_time = 0
    late = 0
    detail = []
    for serial_no, start in starts.items():
        end = ends.get(serial_no)
        if end is None:
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
    """Queryset de detalle — sorting/filtering resuelto aquí; la
    paginación la aplica la view (PageNumberPagination, igual que audit)."""
    return repo.history_queryset(filters).order_by(ordering)
