# apps/ssi_common/bu_classification.py
"""
Fuente unica de verdad para la clasificacion de Business Unit por workcenter.

Antes vivia duplicada en apps/quality/cogp/services/cogp_live_trend_service.py.
Cualquier modulo que necesite clasificar por BU importa de aqui 

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
    "Velocidad Prueba Final":   BusinessUnit.JOHN_DEERE,
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


# ─────────────────────────────────────────────────────────────────────────
# CLIENTE (distinto de Business Unit)
#
# BusinessUnit es la unidad de negocio interna; el cliente es a quien se le
# surte. Coinciden para Volvo/Cummins/TULC pero no para Speed, que es una
# BU cuyo cliente es John Deere.
#
# Capa ADITIVA: no altera ninguno de los tres criterios de arriba ni su
# valor de retorno, asi que COGP y Scrap Rate no se enteran de que existe.
# Se apoya en resolve_bu_from_workcenter (el criterio amplio) porque el
# consumidor -- KPIs de Downtime -- necesita clasificar TODO el piso, no
# solo los workcenters terminales.
# ─────────────────────────────────────────────────────────────────────────

CUSTOMER_VOLVO = "Volvo"
CUSTOMER_CUMMINS = "Cummins"
CUSTOMER_JOHN_DEERE = "John Deere"
CUSTOMER_TULC = "TULC"

# Orden fijo de despliegue en KPIs. Un cliente sin downtime en el rango se
# pinta en cero en vez de desaparecer -- una rejilla de KPIs que cambia de
# forma segun los datos es ilegible en una estacion compartida de planta.
CUSTOMER_DISPLAY_ORDER = (
    CUSTOMER_VOLVO,
    CUSTOMER_CUMMINS,
    CUSTOMER_JOHN_DEERE,
    CUSTOMER_TULC,
)

_BU_TO_CUSTOMER = {
    BusinessUnit.VOLVO:   CUSTOMER_VOLVO,
    BusinessUnit.CUMMINS: CUSTOMER_CUMMINS,
    BusinessUnit.TULC:    CUSTOMER_TULC,
}

# Grupos cuyo cliente no se deduce de la BU. Se resuelve por grupo completo
# porque dentro de Speed no hay particion por cliente conocida.
GROUP_TO_CUSTOMER = {
    "Speed": CUSTOMER_JOHN_DEERE,

    # ⚠️ PENDIENTE DE CONFIRMAR CON NEGOCIO (2026-08-06):
    # 'Speed - WSS/JET/BA' tiene 7 workcenters activos y ningun cliente
    # asignado. Mientras siga comentado cae al bucket "Sin clasificar" y
    # se ve en el KPI gris. Descomentar SOLO cuando planta lo confirme.
    # "Speed - WSS/JET/BA": CUSTOMER_JOHN_DEERE,
}


def resolve_customer_from_workcenter(
    workcenter_group: str | None,
    workcenter: str,
) -> str | None:
    """
    Cliente al que pertenece un workcenter. None = sin clasificar; el
    consumidor debe MOSTRARLO, no esconderlo -- un workcenter sin cliente
    es un hueco de configuracion, no un dato que se pueda tirar.
    """
    if not workcenter_group:
        return None
    bu = resolve_bu_from_workcenter(workcenter_group, workcenter)
    if bu is not None:
        return _BU_TO_CUSTOMER.get(bu)
    return GROUP_TO_CUSTOMER.get(workcenter_group)