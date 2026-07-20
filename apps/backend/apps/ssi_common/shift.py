"""
Clasificación de turno de planta a partir de un timestamp.

Asume que el timestamp ya viene en hora local de planta (Tijuana). No se
encontró ninguna conversión de zona horaria en el pipeline CCS → qwall-proxy
→ Django en ningún punto existente — los reportes de semana/mes ya confían
en started_at crudo sin normalizar (DATEPART(WEEK), DATENAME(MONTH) en
qwall-proxy/main.py). Si se confirma que CCS entrega en otra zona horaria,
ajustar únicamente aquí.
"""
from datetime import datetime

SHIFT_A = "A"
SHIFT_B = "B"


def get_shift(timestamp: datetime) -> str:
    """Turno A: 06:00–17:59. Turno B: 18:00–05:59. Simétrico, 12h cada uno."""
    hour = timestamp.hour
    return SHIFT_A if 6 <= hour < 18 else SHIFT_B
