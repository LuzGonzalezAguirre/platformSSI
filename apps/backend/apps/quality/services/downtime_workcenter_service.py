# apps/quality/services/downtime_workcenter_service.py
import logging

from apps.quality.models.downtime_workcenter import DowntimeWorkcenter
from apps.quality.services import downtime_repository

logger = logging.getLogger(__name__)


def sync_workcenters() -> dict:
    """
    Llamado por Celery Beat (diario — el catálogo cambia poco).
    Upsert por nombre; marca como inactivos los que ya no vienen de Plex
    en vez de borrarlos, para no romper FKs de asignaciones históricas.
    """
    raw = downtime_repository.fetch_workcenters()
    seen_names = set()

    created, updated = 0, 0
    for row in raw:
        name = row.get("Workcenter")
        group = row.get("Workcenter_Group") or ""
        if not name:
            continue
        seen_names.add(name)
        obj, was_created = DowntimeWorkcenter.objects.update_or_create(
            name=name,
            defaults={"workcenter_group": group, "active": True},
        )
        created += int(was_created)
        updated += int(not was_created)

    deactivated = (
        DowntimeWorkcenter.objects
        .exclude(name__in=seen_names)
        .update(active=False)
    )

    logger.info(
        "sync_workcenters: %s creados, %s actualizados, %s desactivados",
        created, updated, deactivated,
    )
    return {"created": created, "updated": updated, "deactivated": deactivated}


def list_active_workcenters():
    return DowntimeWorkcenter.objects.filter(active=True).order_by("name")