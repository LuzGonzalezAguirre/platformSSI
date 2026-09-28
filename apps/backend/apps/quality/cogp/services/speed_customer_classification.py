"""
Clasificacion de cliente (John Deere / Eaton) para eventos de SCRAP dentro
del grupo Speed, por routing completo -- no solo el workcenter terminal.

Motivo: a diferencia de Volvo/Cummins/TULC (donde el numero de parte
identifica el cliente de forma inequivoca), dentro de Speed hay partes de
empaque generico (cajas, separadores) reutilizadas entre John Deere y
Eaton segun conveniencia de planta -- confirmado 2026-08-25 con Part_No
26640.1/26641.1/26642.1 (clasificados por nombre como "Eaton" en
CustomerPartMapping) apareciendo con Note="Empaque JD" en eventos de
scrap. Clasificar esas partes por Part_No produce costos de scrap mal
atribuidos entre clientes.

Fix: para SCRAP (no produccion), clasificar primero por Workcenter -- la
linea fisica donde ocurrio el evento es una senal mas confiable que el
nombre de la parte para este caso. Los workcenters de cada ruta son
exclusivos entre si, EXCEPTO "Velocidad Moldeo AS1", que es una maquina
compartida fisicamente entre ambas rutas (confirmado via Workcenter_Key
78740 -- un solo registro en Plex, no dos). Para ese unico caso ambiguo,
se usa el mismo fallback por Part_No via CustomerPartMapping que ya usa
el resto del sistema.
"""
from apps.quality.models import BusinessUnit

EATON_SPEED_WORKCENTERS = frozenset({
    "Velocidad - Prueba Final",
    "Velocidad - Moldeadora - Arburg R5",
    "Velocidad - Bobinadora de 12 Niveles",
})

JOHN_DEERE_SPEED_WORKCENTERS = frozenset({
    "Velocidad Corte y Formado de IC",
    "Velocidad Ensamble de Copa",
    "Velocidad Ensamble de Transportador",
    "Velocidad Moldeo AS1",
    "Velocidad QC Inspección",
    "Velocidad - Corte y Formado de IC",
})

# Finished Good terminales exclusivos por cliente.
EATON_FINISHED_GOOD_WORKCENTER = "Velocidad - Prueba Final"
JOHN_DEERE_FINISHED_GOOD_WORKCENTER = "Velocidad - Prueba Final 3"


def resolve_speed_scrap_bu(
    workcenter: str | None,
    part_no: str | None,
    part_to_bu: dict[str, str],
) -> str | None:
    """
    Resuelve business_unit para un evento de SCRAP dentro del grupo Speed.
    Retorna None si el workcenter no esta en ninguna ruta conocida ni es
    el compartido -- el consumidor decide que hacer con lo no clasificado
    (igual que el resto de funciones de clasificacion del proyecto).
    """
    wc = (workcenter or "").strip()

    if wc == EATON_FINISHED_GOOD_WORKCENTER:
        return BusinessUnit.EATON
    if wc == JOHN_DEERE_FINISHED_GOOD_WORKCENTER:
        return BusinessUnit.JOHN_DEERE

    if wc in JOHN_DEERE_SPEED_WORKCENTERS:
        return BusinessUnit.JOHN_DEERE
    if wc in EATON_SPEED_WORKCENTERS:
        return BusinessUnit.EATON
    return None


def resolve_speed_production_bu(
    workcenter: str | None,
    part_no: str | None,
    part_to_bu: dict[str, str],
) -> str:
    """
    Clasifica PRODUCCION/Finished Good de Speed por terminal exclusivo.

    Eaton: Velocidad - Prueba Final.
    John Deere: Velocidad - Prueba Final 3.
    Los terminales no se comparten y no dependen del Part_No.
    """
    wc = (workcenter or "").strip()
    base_part_no = str(part_no or "").strip().split(".")[0]
    mapped_bu = (
        part_to_bu.get(str(part_no or "").strip())
        or part_to_bu.get(base_part_no)
        or BusinessUnit.SPEED
    )

    if wc == EATON_FINISHED_GOOD_WORKCENTER:
        return BusinessUnit.EATON
    if wc == JOHN_DEERE_FINISHED_GOOD_WORKCENTER:
        return BusinessUnit.JOHN_DEERE

    if wc in EATON_SPEED_WORKCENTERS:
        return BusinessUnit.EATON

    if mapped_bu in (BusinessUnit.JOHN_DEERE, BusinessUnit.EATON):
        return BusinessUnit.SPEED
    return mapped_bu
