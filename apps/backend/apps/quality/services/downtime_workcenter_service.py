# apps/quality/services/downtime_workcenter_service.py
import logging
from collections import Counter

from apps.quality.models.downtime_workcenter import DowntimeWorkcenter
from apps.quality.services import downtime_repository
from apps.quality.services.downtime_assignment_resolver import GROUP_DISPLAY_ORDER

logger = logging.getLogger(__name__)

# Allow-list de Workcenter_Group que entran al módulo de Downtime.
#
# Es la MISMA constante que ordena el árbol de asignación a propósito: si el
# sync trae un grupo que la UI no ordena, o al revés, tienes filas fantasma.
# Vive aquí y no en el SQL del proxy porque agregar un grupo debe ser un
# cambio versionado en git, no una edición manual de main.py en el server
# de producción seguida de un restart a mano.
SYNC_GROUP_ALLOWLIST = frozenset(GROUP_DISPLAY_ORDER)

# Sólo workcenters con Active = 1 en Plex. Plex es la fuente de verdad del
# catálogo; una máquina dada de baja no debe poder recibir inspector porque
# nunca va a generar logs y el turno asignado ahí se pierde.
#
# Nota: los workcenters de 'Molding' vienen con Active = 0 (verificado
# 2026-08-06), así que ese grupo puede quedar vacío y no aparecer en el
# árbol. Si planta confirma que esas Arburg sí están corriendo, el problema
# es el catálogo de Plex, no este flag.
REQUIRE_PLEX_ACTIVE = True


def _is_active(raw_value) -> bool:
    """El proxy puede regresar 1/0, True/False o '1'/'0' según el driver."""
    return str(raw_value if raw_value is not None else 1).strip().lower() not in (
        "0", "false", "",
    )


def sync_workcenters() -> dict:
    """
    Llamado por Celery Beat (diario — el catálogo cambia poco) o a mano en
    cada entorno nuevo. Una sola llamada al proxy, sin loops.

    Upsert por nombre; marca como inactivos los que ya no vienen de Plex,
    salieron del allow-list o se dieron de baja — nunca los borra, para no
    romper el FK PROTECT de las asignaciones históricas.
    """
    raw = downtime_repository.fetch_workcenters()

    seen_names = set()
    created, updated = 0, 0
    skipped_groups: Counter = Counter()
    skipped_inactive = 0

    for row in raw:
        # Plex trae espacios finales con frecuencia. Sin strip,
        # 'Speed - WSS/JET/BA ' no hace match y el grupo desaparece sin error.
        name = (row.get("Workcenter") or "").strip()
        group = (row.get("Workcenter_Group") or "").strip()
        if not name:
            continue

        if SYNC_GROUP_ALLOWLIST is not None and group not in SYNC_GROUP_ALLOWLIST:
            skipped_groups[group or "(vacío)"] += 1
            continue

        if REQUIRE_PLEX_ACTIVE and not _is_active(row.get("Active")):
            skipped_inactive += 1
            continue

        seen_names.add(name)
        _, was_created = DowntimeWorkcenter.objects.update_or_create(
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

    by_group = dict(
        Counter(
            wc.workcenter_group
            for wc in DowntimeWorkcenter.objects.filter(active=True)
        )
    )

    logger.info(
        "sync_workcenters: %s creados, %s actualizados, %s desactivados. "
        "Activos por grupo: %s. Descartados — grupo: %s, inactivos en Plex: %s",
        created, updated, deactivated, by_group, dict(skipped_groups), skipped_inactive,
    )

    return {
        "created": created,
        "updated": updated,
        "deactivated": deactivated,
        "active_by_group": by_group,
        "skipped_by_group": dict(skipped_groups),
        "skipped_inactive": skipped_inactive,
    }


def list_active_workcenters():
    return DowntimeWorkcenter.objects.filter(active=True).order_by("name")

def get_workcenter_group_map() -> dict[str, str]:
    """
    {workcenter_name: workcenter_group} sobre el catalogo COMPLETO, activos
    e inactivos.

    Incluye inactivos a proposito: los logs de Plex pueden referenciar
    workcenters dados de baja despues de haber generado downtime. Si se
    filtrara por active=True, esos minutos caerian a "Sin clasificar" y el
    KPI del cliente reportaria de menos.
    """
    return dict(
        DowntimeWorkcenter.objects.values_list("name", "workcenter_group")
    )