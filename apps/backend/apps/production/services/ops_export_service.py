# apps/backend/apps/production/services/ops_export_service.py

import os
import copy
from datetime import date, timedelta
from io import BytesIO

import openpyxl

from apps.production.services.ops_report_service import OpsReportService
from apps.production.repositories.safety_repository import SafetyRepository

TEMPLATE_PATH = os.path.join(
    os.path.dirname(__file__),
    "../templates/excel/ops_daily_template.xlsx"
)

# Mapeo BU → filas de la plantilla
BU_MAP = {
    "volvo": {
        "summary_row": 15,   # fila de resumen del día consultado
        "week_start":  20,   # primera fila de la semana (Mon)
        "total_row":   25,
    },
    "cummins": {
        "summary_row": 31,
        "week_start":  36,
        "total_row":   41,
    },
    "tulc": {
        "summary_row": 47,
        "week_start":  52,
        "total_row":   57,
    },
}

DAY_LABEL_COL = 4   # columna D
DATE_COL      = 5   # columna E
PRODUCED_COL  = 6   # columna F
TARGET_COL    = 7   # columna G
DAY_PCT_COL   = 8   # columna H
CUM_PROD_COL  = 9   # columna I
CUM_GOAL_COL  = 10  # columna J
CUM_PCT_COL   = 11  # columna K
SCRAP_CUM_COL = 13  # columna M


def _w(ws, row: int, col: int, value):
    """Escribe valor en celda solo si no es None."""
    if value is not None:
        ws.cell(row=row, column=col, value=value)


def generate_daily_excel(report_date: date) -> BytesIO:
    # Cargar datos (ya están cacheados por el reporte normal)
    summary    = OpsReportService.get_daily_summary(report_date)
    safety     = SafetyRepository.get_settings("Tijuana")

    # Obtener la semana del día consultado
    monday = report_date - timedelta(days=report_date.weekday())
    
    # Cargar tablas de cada BU (modo daily = semana)
    bu_tables = {}
    for bu in ("volvo", "cummins", "tulc"):
        bu_tables[bu] = OpsReportService.get_weekly_table(report_date, bu, "daily")

    # Productividad: calculada igual que en OpsReportPage
    # Se deja vacía si no hay datos (la plantilla puede tener fórmula)
    productivity_pct = None  # puedes enriquecer si tienes paidHours en este contexto

    # Cargar plantilla
    wb = openpyxl.load_workbook(TEMPLATE_PATH)
    ws = wb.active  # o wb["NombreHoja"] si tiene nombre específico

    # ── HEADER ───────────────────────────────────────────────
    _w(ws, 6,  5, report_date)          # E6  → fecha del reporte
    _w(ws, 8,  4, safety.days_without_incident)  # D8  → días sin accidente
    if productivity_pct is not None:
        _w(ws, 10, 4, round(productivity_pct / 100, 4))  # D10 → % productividad

    # ── POR BU ───────────────────────────────────────────────
    for bu, cfg in BU_MAP.items():
        day_data: dict = summary.get(bu, {})
        table         = bu_tables[bu]
        periods       = table.get("periods", [])
        totals        = table.get("totals", {})
        sr            = cfg["summary_row"]
        ws_row        = cfg["week_start"]

        # Fila resumen del día consultado (F15/F31/F47 etc.)
        _w(ws, sr, 6,  day_data.get("quantity"))           # F → piezas
        _w(ws, sr, 7,  day_data.get("target"))             # G → target
        _w(ws, sr, 8,  _pct_decimal(day_data.get("production_pct")))  # H → %
        # I → vacío (columna de separación en tu template)
        _w(ws, sr, 10, day_data.get("wip_goal"))            # J → WIP Goal
        _w(ws, sr, 11, day_data.get("wip_actual"))          # K → WIP Actual
        _w(ws, sr, 12, _pct_decimal(day_data.get("yield_pct")))       # L → Yield Rate
        _w(ws, sr, 13, _pct_decimal(day_data.get("scrap_cogp_pct")))  # M → Scrap COGP %

        # Filas semanales Mon–Fri
        for i, period in enumerate(periods[:5]):  # máx 5 días (Mon–Fri)
            row = ws_row + i
            date_obj = _parse_date(period.get("date_str"), monday, i)

            _w(ws, row, DATE_COL,      date_obj)                                         # E → fecha
            _w(ws, row, PRODUCED_COL,  period.get("produced"))                           # F → producción
            _w(ws, row, TARGET_COL,    period.get("target"))                              # G → target
            _w(ws, row, DAY_PCT_COL,   _pct_decimal(period.get("day_pct")))              # H → %
            _w(ws, row, CUM_PROD_COL,  period.get("cum_produced"))                       # I → acum producido
            _w(ws, row, CUM_GOAL_COL,  period.get("cum_target"))                         # J → goal acum
            _w(ws, row, CUM_PCT_COL,   _pct_decimal(period.get("cum_pct")))              # K → % acum
            _w(ws, row, SCRAP_CUM_COL, _pct_decimal(period.get("scrap_cogp_cum")))       # M → acum scrap COGP

        # Totales (F25/F41/F57)
        _w(ws, cfg["total_row"], 6, totals.get("produced"))   # F → total producido
        _w(ws, cfg["total_row"], 7, totals.get("target"))     # G → total target

    # ── SERIALIZAR ───────────────────────────────────────────
    output = BytesIO()
    wb.save(output)
    output.seek(0)
    return output


def _pct_decimal(value) -> float | None:
    """Convierte porcentaje (ej: 95.3) a decimal Excel (0.953)."""
    if value is None:
        return None
    return round(float(value) / 100, 6)


def _parse_date(date_str: str | None, monday: date, offset: int) -> date:
    """Fallback: si date_str no parseable, calcula desde lunes."""
    if date_str:
        try:
            from datetime import datetime
            return datetime.strptime(date_str, "%Y-%m-%d").date()
        except ValueError:
            pass
    return monday + timedelta(days=offset)