"""
Utilidades de rango para el filtro estándar de turno.

Este archivo NO redefine SHIFT_A/SHIFT_B ni la lógica de clasificación
de un timestamp individual — eso ya existe en apps.ssi_common.shift y
se importa de ahí. Este archivo solo agrega lo que falta para trabajar
con RANGOS de fecha (start_date/end_date) en vez de un timestamp suelto.
"""
from datetime import date, datetime, time, timedelta

from apps.ssi_common.shift import SHIFT_A, SHIFT_B, get_shift

ALL_SHIFTS = (SHIFT_A, SHIFT_B)


class ShiftCalendarResolver:

    @staticmethod
    def fetch_bounds(start_date: date, end_date: date, shifts: tuple[str, ...] = ()) -> tuple[datetime, datetime]:
        """
        Límite datetime a pedir a la fuente de datos (Postgres o proxy).

        Si el turno B está incluido (o no se especificó turno, lo cual
        significa "todos"), el límite superior se extiende hasta las
        06:00 del día siguiente a end_date, porque el turno B del último
        día cruza la medianoche y termina a las 05:59.
        """
        lower = datetime.combine(start_date, time.min)

        if not shifts or SHIFT_B in shifts:
            upper = datetime.combine(end_date + timedelta(days=1), time(6, 0))
        else:
            upper = datetime.combine(end_date + timedelta(days=1), time.min)

        return lower, upper

    @staticmethod
    def shift_date(dt: datetime) -> date:
        """
        Fecha OPERATIVA de turno para un timestamp, no su fecha calendario.

        Un registro de turno B a la 1:00am del día 15 pertenece
        operativamente al turno B que arrancó el día 14 a las 6pm.
        Sin esto, cualquier reporte agrupado por "turno + día" partiría
        el turno B en dos fechas calendario distintas incorrectamente.
        """
        if get_shift(dt) == SHIFT_B and dt.time() < time(6, 0):
            return (dt - timedelta(days=1)).date()
        return dt.date()

    @staticmethod
    def matches(dt: datetime, shifts: tuple[str, ...]) -> bool:
        """
        Predicado para filtrar una lista de registros ya traídos
        (post-fetch), no para usar dentro de una query SQL.
        """
        if not shifts:
            return True
        return get_shift(dt) in shifts