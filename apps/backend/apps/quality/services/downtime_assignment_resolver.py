# apps/quality/services/downtime_assignment_resolver.py
"""
Resolución de inspector por (día, workcenter).

PRECEDENCIA dentro de un mismo día:
    override de workcenter  >  asignación de subgrupo  >  asignación de grupo

HERENCIA entre días: si un día no tiene ninguna decisión aplicable a un
workcenter, se camina hacia atrás hasta INHERITANCE_LOOKBACK_DAYS buscando el
día más reciente que sí la tenga.

El walk se detiene en el PRIMER día con cualquier coincidencia. Consecuencia
deliberada: un día con asignación de grupo NO deja pasar un override de
workcenter más viejo — ese día ya tomó una decisión explícita sobre el scope.

Una fila con inspector_user_id = NULL es una decisión explícita ("sin
asignar") y detiene la herencia. Solo la AUSENCIA de fila permite heredar.

Todo aquí es Postgres. Cero llamadas a Plex — por eso el reporte puede
llamarlo fuera del cache de 10 minutos sin violar la ERP Protection Rule.
"""
import logging
from datetime import date as date_cls, timedelta
from typing import Iterable, Optional

from apps.quality.models.downtime_group_assignment import DowntimeGroupAssignment
from apps.quality.models.downtime_workcenter import DowntimeWorkcenter
from apps.quality.models.downtime_workcenter_assignment import DowntimeWorkcenterAssignment
from apps.ssi_common.bu_classification import resolve_bu_from_workcenter

logger = logging.getLogger(__name__)

# Ventana máxima de herencia. Con 7, un lunes hereda del viernes anterior.
# Subirlo hace que reportes viejos muestren inspectores muy desfasados;
# bajarlo a 1 rompe la continuidad sobre fines de semana y días festivos.
INHERITANCE_LOOKBACK_DAYS = 7

# Orden de presentación en la UI. Lo que no esté aquí se ordena alfabéticamente
# al final — así un grupo nuevo que llegue de Plex aparece, no desaparece.
GROUP_DISPLAY_ORDER = (
    "Heater Module",
    "Molding",
    "Speed",
    "Speed - WSS/JET/BA",
    "TULC",
)

# Único grupo con partición interna por Business Unit. La regla vive en
# apps.ssi_common.bu_classification — NO se duplica aquí.
SUBGROUPED_GROUPS = frozenset({"Heater Module"})


def _enum_value(value):
    """BusinessUnit puede ser TextChoices; normaliza a str plano."""
    return str(getattr(value, "value", value))


def resolve_subgroup_key(group_key: str, workcenter_name: str) -> str:
    """
    Subgrupo de BU al que pertenece un workcenter dentro de su grupo.
    Cadena vacía = el grupo no se subdivide.
    """
    if group_key not in SUBGROUPED_GROUPS:
        return ""
    bu = resolve_bu_from_workcenter(group_key, workcenter_name)
    return _enum_value(bu) if bu else ""


def group_sort_key(group_key: str) -> tuple:
    try:
        return (0, GROUP_DISPLAY_ORDER.index(group_key), "")
    except ValueError:
        return (1, 0, group_key)


def build_scope_index(workcenters: Iterable[DowntimeWorkcenter]) -> dict:
    """{workcenter_name: (group_key, subgroup_key)}"""
    index = {}
    for wc in workcenters:
        group_key = wc.workcenter_group or ""
        index[wc.name] = (group_key, resolve_subgroup_key(group_key, wc.name))
    return index


def _entry(user_id, name, source, target_day: date_cls, found_day: Optional[date_cls]) -> dict:
    return {
        "inspector_user_id": user_id,
        "inspector_name": name or None,
        "source": source,
        "inherited_from": (
            found_day.isoformat()
            if found_day is not None and found_day != target_day
            else None
        ),
    }


def load_decision_maps(window_start: date_cls, date_to: date_cls) -> tuple[dict, dict]:
    """
    Dos queries. Devuelve:
      wc_map:  {(date, workcenter_name): (user_id, name)}
      grp_map: {(date, group_key, subgroup_key): (user_id, name)}
    """
    wc_map = {
        (a.date, a.workcenter.name): (a.inspector_user_id, a.inspector_name)
        for a in (
            DowntimeWorkcenterAssignment.objects
            .filter(date__gte=window_start, date__lte=date_to)
            .select_related("workcenter")
        )
    }
    grp_map = {
        (g.date, g.group_key, g.subgroup_key): (g.inspector_user_id, g.inspector_name)
        for g in DowntimeGroupAssignment.objects.filter(
            date__gte=window_start, date__lte=date_to,
        )
    }
    return wc_map, grp_map


def _resolve_workcenter(
    day: date_cls,
    workcenter_name: str,
    group_key: str,
    subgroup_key: str,
    wc_map: dict,
    grp_map: dict,
    window_start: date_cls,
) -> dict:
    probe = day
    while probe >= window_start:
        hit = wc_map.get((probe, workcenter_name))
        if hit is not None:
            return _entry(hit[0], hit[1], "workcenter", day, probe)

        if subgroup_key:
            hit = grp_map.get((probe, group_key, subgroup_key))
            if hit is not None:
                return _entry(hit[0], hit[1], "subgroup", day, probe)

        hit = grp_map.get((probe, group_key, ""))
        if hit is not None:
            return _entry(hit[0], hit[1], "group", day, probe)

        probe -= timedelta(days=1)

    return _entry(None, None, None, day, None)


def resolve_scope(
    day: date_cls,
    group_key: str,
    subgroup_key: str,
    grp_map: dict,
    window_start: date_cls,
) -> dict:
    """Valor efectivo de un scope (para el selector de nivel grupo/subgrupo)."""
    probe = day
    while probe >= window_start:
        if subgroup_key:
            hit = grp_map.get((probe, group_key, subgroup_key))
            if hit is not None:
                return _entry(hit[0], hit[1], "subgroup", day, probe)

        hit = grp_map.get((probe, group_key, ""))
        if hit is not None:
            return _entry(hit[0], hit[1], "group", day, probe)

        probe -= timedelta(days=1)

    return _entry(None, None, None, day, None)


def resolve_range(
    date_from: date_cls,
    date_to: date_cls,
    workcenters: Optional[Iterable[DowntimeWorkcenter]] = None,
) -> dict:
    """
    {(date, workcenter_name): {inspector_user_id, inspector_name, source,
                               inherited_from}}

    Costo: 2 queries a Postgres + resolución en memoria. Los consumidores
    (reporte de downtime y settings) comparten esta función a propósito:
    si divergen, el reporte muestra un inspector distinto al que se ve en
    el formulario y nadie entiende por qué.
    """
    if workcenters is None:
        workcenters = list(DowntimeWorkcenter.objects.filter(active=True).order_by("name"))
    else:
        workcenters = list(workcenters)

    scope_index = build_scope_index(workcenters)
    window_start = date_from - timedelta(days=INHERITANCE_LOOKBACK_DAYS)
    wc_map, grp_map = load_decision_maps(window_start, date_to)

    resolved = {}
    day = date_from
    while day <= date_to:
        for wc in workcenters:
            group_key, subgroup_key = scope_index[wc.name]
            resolved[(day, wc.name)] = _resolve_workcenter(
                day, wc.name, group_key, subgroup_key, wc_map, grp_map, window_start,
            )
        day += timedelta(days=1)

    return resolved


def resolve_range_by_iso(date_from: date_cls, date_to: date_cls) -> dict:
    """Misma resolución, con la fecha ya en ISO — conveniencia para el reporte."""
    return {
        (day.isoformat(), name): value
        for (day, name), value in resolve_range(date_from, date_to).items()
    }