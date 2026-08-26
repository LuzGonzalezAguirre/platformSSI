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
    "Velocidad - Moldeadora - Arburg R5",
    "Velocidad - Moldeadora - Arburg R1",
    "Velocidad - Moldeadora - Arburg R4",
    "Velocidad - Prueba Final",
    "Velocidad - Prueba Final 2",
})

JOHN_DEERE_SPEED_WORKCENTERS = frozenset({
    "Velocidad Ensamble de Transportador",
    "Velocidad QC Inspección",
    "Velocidad Ensamble de Copa",
    "Velocidad Prueba Final",
})

# Unico workcenter Speed compartido fisicamente entre John Deere y Eaton
# (Workcenter_Key=78740, un solo registro en Plex). Resuelto por Part_No,
# no por nombre de workcenter.
SHARED_SPEED_WORKCENTER = "Velocidad Moldeo AS1"


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

    if wc in EATON_SPEED_WORKCENTERS:
        return BusinessUnit.EATON
    if wc in JOHN_DEERE_SPEED_WORKCENTERS:
        return BusinessUnit.JOHN_DEERE
    if wc == SHARED_SPEED_WORKCENTER:
        base_part_no = str(part_no or "").strip().split(".")[0]
        return part_to_bu.get(base_part_no)
    return None