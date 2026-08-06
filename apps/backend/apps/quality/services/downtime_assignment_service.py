# apps/quality/services/downtime_assignment_service.py
"""
Capa de servicio del formulario de asignación de inspectores.

Contrato de escritura: REPLACE-SET por día. Lo que no venga en el payload
se BORRA para esa fecha. Es deliberado — permite quitar un override sin un
endpoint DELETE aparte, y evita el estado zombi de filas viejas que ya no
representan ninguna decisión.
"""
import logging
from datetime import date as date_cls, timedelta

from django.db import transaction

from apps.quality.models.downtime_group_assignment import DowntimeGroupAssignment
from apps.quality.models.downtime_workcenter_assignment import DowntimeWorkcenterAssignment
from apps.quality.services import downtime_assignment_resolver as resolver
from apps.quality.services import downtime_workcenter_service

logger = logging.getLogger(__name__)


class DowntimeAssignmentError(Exception):
    pass


def _subgroup_label(subgroup_key: str, group_key: str) -> str:
    if not subgroup_key:
        return group_key
    return subgroup_key.replace("_", " ").title()


def build_assignment_tree(target_date: date_cls) -> list[dict]:
    """
    Árbol group → subgroup → workcenters, con el valor efectivo resuelto en
    cada nivel (incluyendo herencia). El frontend no calcula nada: solo
    pinta y deja editar.
    """
    workcenters = list(downtime_workcenter_service.list_active_workcenters())
    scope_index = resolver.build_scope_index(workcenters)

    window_start = target_date - timedelta(days=resolver.INHERITANCE_LOOKBACK_DAYS)
    wc_map, grp_map = resolver.load_decision_maps(window_start, target_date)

    buckets: dict[tuple[str, str], list] = {}
    for wc in workcenters:
        group_key, subgroup_key = scope_index[wc.name]
        buckets.setdefault((group_key, subgroup_key), []).append(wc)

    grouped: dict[str, list] = {}
    for (group_key, subgroup_key), wcs in buckets.items():
        scope_value = resolver.resolve_scope(
            target_date, group_key, subgroup_key, grp_map, window_start,
        )
        node = {
            "group_key": group_key,
            "subgroup_key": subgroup_key,
            "label": _subgroup_label(subgroup_key, group_key),
            **scope_value,
            "workcenters": [
                {
                    "workcenter_id": wc.id,
                    "workcenter_name": wc.name,
                    **resolver._resolve_workcenter(
                        target_date, wc.name, group_key, subgroup_key,
                        wc_map, grp_map, window_start,
                    ),
                }
                for wc in sorted(wcs, key=lambda w: w.name)
            ],
        }
        grouped.setdefault(group_key, []).append(node)

    tree = []
    for group_key in sorted(grouped.keys(), key=resolver.group_sort_key):
        subgroups = sorted(grouped[group_key], key=lambda n: n["subgroup_key"])
        tree.append({
            "group_key": group_key,
            "label": group_key or "(sin grupo)",
            "workcenter_count": sum(len(n["workcenters"]) for n in subgroups),
            "subgroups": subgroups,
        })
    return tree


def _validate_scopes(target_date: date_cls, groups: list) -> set:
    """Rechaza scopes inexistentes — evita basura en DB por payloads mal armados."""
    workcenters = list(downtime_workcenter_service.list_active_workcenters())
    scope_index = resolver.build_scope_index(workcenters)

    valid = set()
    for group_key, subgroup_key in scope_index.values():
        valid.add((group_key, ""))
        if subgroup_key:
            valid.add((group_key, subgroup_key))

    for item in groups:
        key = (item["group_key"], item.get("subgroup_key") or "")
        if key not in valid:
            raise DowntimeAssignmentError(
                f"Scope inválido: group_key='{key[0]}', subgroup_key='{key[1]}'."
            )
    return valid


@transaction.atomic
def save_assignments(target_date: date_cls, groups: list, overrides: list, user) -> dict:
    _validate_scopes(target_date, groups)

    keep_scopes = set()
    for item in groups:
        group_key = item["group_key"]
        subgroup_key = item.get("subgroup_key") or ""
        keep_scopes.add((group_key, subgroup_key))
        DowntimeGroupAssignment.objects.update_or_create(
            date=target_date,
            group_key=group_key,
            subgroup_key=subgroup_key,
            defaults={
                "inspector_user_id": item.get("inspector_user_id"),
                "inspector_name": item.get("inspector_name") or None,
                "updated_by": user,
            },
        )

    stale_group_ids = [
        row.id
        for row in DowntimeGroupAssignment.objects.filter(date=target_date)
        if (row.group_key, row.subgroup_key) not in keep_scopes
    ]
    if stale_group_ids:
        DowntimeGroupAssignment.objects.filter(id__in=stale_group_ids).delete()

    keep_wc_ids = set()
    for item in overrides:
        workcenter_id = item["workcenter_id"]
        keep_wc_ids.add(workcenter_id)
        DowntimeWorkcenterAssignment.objects.update_or_create(
            workcenter_id=workcenter_id,
            date=target_date,
            defaults={
                "inspector_user_id": item.get("inspector_user_id"),
                "inspector_name": item.get("inspector_name") or None,
                "updated_by": user,
            },
        )

    DowntimeWorkcenterAssignment.objects.filter(date=target_date).exclude(
        workcenter_id__in=keep_wc_ids,
    ).delete()

    logger.info(
        "save_assignments %s: %s scopes, %s overrides, %s scopes borrados",
        target_date, len(keep_scopes), len(keep_wc_ids), len(stale_group_ids),
    )
    return {
        "date": target_date.isoformat(),
        "groups_saved": len(keep_scopes),
        "overrides_saved": len(keep_wc_ids),
    }