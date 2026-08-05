# apps/ssi_common/bu_classification.py
"""
Fuente unica de verdad para la clasificacion de Business Unit por workcenter.

Antes vivia duplicada en apps/quality/cogp/services/cogp_live_trend_service.py.
Cualquier modulo que necesite clasificar por BU importa de aqui -- si esta
regla vuelve a existir en dos lugares, vuelven las discrepancias entre
modulos (ver bug de Scrap Rate 35-47%, sesion 2026-07-29).
"""
from apps.quality.models import BusinessUnit

VOLVO_HM_WORKCENTERS = {"HM Ensamble Final 2", "HM Ensamble Frontal 2"}

PRODUCTION_WORKCENTER_TO_BU = {
    "HM Ensamble Final 2":      BusinessUnit.VOLVO,
    "HM Ensamble de Servicio":  BusinessUnit.CUMMINS,
    "TULC Ensamble Final":      BusinessUnit.TULC,
    "HM Empaque":  BusinessUnit.CUMMINS,
    "HM Ensamble Final 3":  BusinessUnit.CUMMINS,
}


def resolve_bu_from_workcenter(workcenter_group: str, workcenter: str) -> str | None:
    """
    Clasificacion por Workcenter_Group + Workcenter.

    'TULC' como grupo va directo a TULC. Dentro de 'Heater Module',
    HM Ensamble Final 2 y HM Ensamble Frontal 2 son Volvo; el resto es
    Cummins. Cualquier otro grupo (Molding, Speed) o workcenter ausente
    regresa None -- el consumidor decide que hacer con los no clasificados.
    """
    if workcenter_group == "TULC":
        return BusinessUnit.TULC
    if workcenter_group == "Heater Module":
        if workcenter in VOLVO_HM_WORKCENTERS:
            return BusinessUnit.VOLVO
        return BusinessUnit.CUMMINS
    return None


def resolve_bu_for_production(workcenter: str) -> str:
    """
    Clasificacion de PRODUCCION por workcenter terminal, fija y sin
    ambiguedad. No usa Part_No -- ese criterio se abandono porque los
    nombres de Plex son ambiguos.
    """
    return PRODUCTION_WORKCENTER_TO_BU.get(workcenter, BusinessUnit.SPEED)