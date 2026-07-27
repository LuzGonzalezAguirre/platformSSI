# apps/quality/tasks.py
"""
Celery tasks para Incoming Inspection. Único punto del proyecto (junto con
incoming_inspection_plex_repository.py) que puede llamar a plex-proxy para
este módulo — ninguna view/serializer/servicio de request-time debe hacerlo.
"""
from datetime import timedelta

from celery import shared_task
from django.db import transaction
from django.utils import timezone

from apps.quality.models import (
    IncomingContainerSnapshot,
    IncomingContainerHistory,
    IncomingInspectionSyncState,
)
from apps.quality.repositories import incoming_inspection_plex_repository as plex_repo

# 6 horas de margen (antes 10 minutos) — Plex tiene latencia real entre que
# un evento ocurre (Change_Date) y queda disponible para consultarse via
# ODBC; con overlap corto, cualquier registro que tarde más de esa ventana
# en aparecer se pierde silenciosamente para siempre (el watermark ya
# avanzó más allá de su Change_Date). Confirmado empíricamente: backfill
# del 27/07 recuperó 4192 filas que el sync incremental normal, corriendo
# sano y sin errores durante 11 días, nunca capturó. No resuelve la causa
# raíz (eso requiere watermark real vía Change_Key, pendiente) pero reduce
# drásticamente la ventana de pérdida mientras tanto.
HISTORY_OVERLAP = timedelta(hours=6)
DEFAULT_HISTORY_LOOKBACK = timedelta(days=1)


def _mark_error(sync_type: str, message: str):
    """
    Registra el error SIN pisar el watermark existente — last_synced_at es
    NOT NULL, así que en la primera corrida (sin fila previa) se usa
    timezone.now() como valor neutral; en corridas subsecuentes se conserva
    el last_synced_at ya guardado para no perder el punto de partida real.
    """
    state = IncomingInspectionSyncState.objects.filter(sync_type=sync_type).first()
    if state:
        state.last_run_status = "error"
        state.last_error_message = message
        state.save(update_fields=["last_run_status", "last_error_message"])
    else:
        IncomingInspectionSyncState.objects.create(
            sync_type=sync_type,
            last_synced_at=timezone.now(),
            last_run_status="error",
            last_error_message=message,
        )


def _mark_ok(sync_type: str, last_synced_at):
    IncomingInspectionSyncState.objects.update_or_create(
        sync_type=sync_type,
        defaults={
            "last_synced_at": last_synced_at,
            "last_run_status": "ok",
            "last_error_message": None,
        },
    )


def upsert_history_rows(rows: list[dict]) -> tuple[int, int]:
    """
    Upsert compartido por el sync incremental y el backfill inicial —
    misma llave (serial_no, change_date, operation_no) que el
    UniqueConstraint del modelo. Retorna (creados, ya_existentes).
    """
    created_count = 0
    existing_count = 0
    for row in rows:
        _, created = IncomingContainerHistory.objects.update_or_create(
            serial_no=row["Serial_No"],
            change_date=row["Change_Date"],
            operation_no=row["Operation_No"],
            defaults={
                "part_no": row["Part_No"],
                "part_key": row.get("Part_Key"),
                "last_action": row.get("Last_Action"),
                "location": row.get("Location"),
                "container_status": row.get("Container_Status"),
                "defect_type": row.get("Defect_Type"),
                "note": row.get("Note"),
                "change_by": row.get("Change_By"),
            },
        )
        if created:
            created_count += 1
        else:
            existing_count += 1
    return created_count, existing_count


@shared_task
def sync_incoming_snapshot():
    try:
        rows = plex_repo.fetch_current_snapshot()

        objects = [
            IncomingContainerSnapshot(
                container_key=row["Container_Key"],
                part_no=row["Part_No"],
                part_operation_key=row.get("Part_Operation_Key"),
                operation_no=row["Operation_No"],
                location=row["Location"],
                quantity=row["Quantity"],
                active=bool(row.get("Active", True)),
            )
            for row in rows
        ]

        with transaction.atomic():
            IncomingContainerSnapshot.objects.all().delete()
            IncomingContainerSnapshot.objects.bulk_create(objects)
    except Exception as exc:
        _mark_error("snapshot", str(exc))
        return

    _mark_ok("snapshot", timezone.now())


@shared_task
def sync_incoming_history():
    state = IncomingInspectionSyncState.objects.filter(sync_type="history").first()
    watermark = (state.last_synced_at if state else timezone.now() - DEFAULT_HISTORY_LOOKBACK) - HISTORY_OVERLAP
    run_started_at = timezone.now()

    try:
        rows = plex_repo.fetch_history_since(watermark)
        upsert_history_rows(rows)
    except Exception as exc:
        _mark_error("history", str(exc))
        return

    _mark_ok("history", run_started_at)