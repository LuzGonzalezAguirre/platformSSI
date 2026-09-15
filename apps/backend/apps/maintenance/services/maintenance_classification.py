"""Clasificacion compartida para todas las vistas de Maintenance."""
from apps.quality.cogp.models.customer_part_mapping import BusinessUnit
from apps.ssi_common.bu_classification import (
    CUSTOMER_JOHN_DEERE,
    resolve_bu_from_workcenter,
    resolve_customer_from_workcenter,
)

UNCLASSIFIED = "UNCLASSIFIED"


def resolve_maintenance_bu(workcenter_group: str | None, workcenter: str | None) -> str:
    """Clasifica todo el piso, incluyendo TULC y la familia Speed."""
    group = (workcenter_group or "").strip()
    name = (workcenter or "").strip()

    bu = resolve_bu_from_workcenter(group, name)
    if bu:
        return str(bu)

    customer = resolve_customer_from_workcenter(group, name)
    if customer == CUSTOMER_JOHN_DEERE:
        return BusinessUnit.JOHN_DEERE

    # Variantes de Speed aun no asignadas a un cliente se mantienen visibles
    # en el bucket SPEED en vez de desaparecer como datos no clasificados.
    if group.lower().startswith("speed"):
        return BusinessUnit.SPEED

    return UNCLASSIFIED
