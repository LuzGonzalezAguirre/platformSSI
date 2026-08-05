# apps/ssi_common/bu_classification.py
"""
Fuente unica de verdad para la clasificacion de Business Unit por workcenter.

Antes vivia duplicada en apps/quality/cogp/services/cogp_live_trend_service.py.
Cualquier modulo que necesite clasificar por BU importa de aqui -- si esta
regla vuelve a existir en dos lugares, vuelven las discrepancias entre
modulos (ver bug de Scrap Rate 35-47%, sesion 2026-07-29).

Existen TRES criterios y no son intercambiables:

  resolve_bu_from_workcenter    -> amplio, por grupo. Todo el piso.
                                   Se usa para COGP en COSTO, donde el scrap
                                   de un componente si cuesta dinero real.

  resolve_bu_for_production     -> por workcenter terminal, con default SPEED.
                                   Compatibilidad con COGP live trend y Pareto.

  resolve_bu_for_finished_goods -> por workcenter terminal, ESTRICTO (None si
                                   no es terminal). Se usa donde numerador y
                                   denominador deben ser la misma pieza fisica,
                                   como Scrap Rate en piezas.

Mezclar el primero con el segundo en la misma metrica produce ratios sin
sentido: se estan comparando componentes contra unidades terminadas.
"""
from apps.quality.models import BusinessUnit

VOLVO_HM_WORKCENTERS = {"HM Ensamble Final 2", "HM Ensamble Frontal 2"}

# Workcenters que reportan PRODUCTO TERMINADO. Este dict es el contrato de
# toda metrica de piezas: agregar o quitar una linea aqui cambia el
# denominador de Scrap Rate en toda la historia cacheada. Al modificarlo,
# bumpear ScrapRateService.CACHE_VERSION.
PRODUCTION_WORKCENTER_TO_BU = {
    "HM Ensamble Final 2":      BusinessUnit.VOLVO,
    "HM Ensamble de Servicio":  BusinessUnit.CUMMINS,
    "TULC Ensamble Final":      BusinessUnit.TULC,
    "HM Empaque":               BusinessUnit.CUMMINS,
    "HM Ensamble Final 3":      BusinessUnit.CUMMINS,
}

TERMINAL_WORKCENTERS = frozenset(PRODUCTION_WORKCENTER_TO_BU)


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

    Default SPEED para lo no clasificado: el consumidor debe filtrar. Si lo
    que necesitas es descartar explicitamente lo no terminal, usa
    resolve_bu_for_finished_goods en su lugar.
    """
    return PRODUCTION_WORKCENTER_TO_BU.get(workcenter, BusinessUnit.SPEED)




SCRAP_RATE_WORKCENTER_TO_BU = {
    "HM Ensamble Final 2":      BusinessUnit.VOLVO,
    "HM Ensamble de Servicio":  BusinessUnit.CUMMINS,
    "TULC Ensamble Final":      BusinessUnit.TULC,
}

TERMINAL_WORKCENTERS = frozenset(SCRAP_RATE_WORKCENTER_TO_BU)

def resolve_bu_for_finished_goods(workcenter: str | None) -> str | None:
    """
    Clasificacion ESTRICTA para Scrap Rate: devuelve la BU solo si el
    workcenter reporta produccion de producto terminado, None en cualquier
    otro caso. Numerador y denominador de la tasa salen de aqui, ambos.
    """
    if not workcenter:
        return None
    return SCRAP_RATE_WORKCENTER_TO_BU.get(workcenter.strip())