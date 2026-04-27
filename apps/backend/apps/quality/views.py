from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from rest_framework import status
from .models import QualityTarget
from .serializers import QualityTargetSerializer
from .services.quality_service import QualityService
from apps.warehouse.services.plex_client import PlexProxyError
from datetime import date, timedelta
from apps.quality.services.qwall_service import QWallService

from openpyxl import Workbook
from openpyxl.styles import Font, PatternFill, Alignment, Border, Side
from datetime import date, timedelta, datetime as dt


class ScrapDetailView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        start     = request.query_params.get("start_date")
        end       = request.query_params.get("end_date")
        use_shift = request.query_params.get("use_shift", "true").lower() == "true"

        if not start or not end:
            return Response({"detail": "start_date y end_date requeridos."}, status=400)
        try:
            data = QualityService().get_scrap_detail(start, end, use_shift)
            return Response(data)
        except PlexProxyError as e:
            return Response({"detail": str(e)}, status=502)


class QualityTargetView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        targets = QualityTarget.objects.all().order_by("level", "bu", "workcenter_name")
        return Response(QualityTargetSerializer(targets, many=True).data)

    def post(self, request):
        serializer = QualityTargetSerializer(data=request.data)
        if not serializer.is_valid():
            return Response(serializer.errors, status=400)
        serializer.save(updated_by=request.user)
        return Response(serializer.data, status=201)

    def put(self, request, pk: int):
        try:
            target = QualityTarget.objects.get(pk=pk)
        except QualityTarget.DoesNotExist:
            return Response({"detail": "No encontrado."}, status=404)
        serializer = QualityTargetSerializer(target, data=request.data, partial=True)
        if not serializer.is_valid():
            return Response(serializer.errors, status=400)
        serializer.save(updated_by=request.user)
        return Response(serializer.data)

    def delete(self, request, pk: int):
        try:
            QualityTarget.objects.get(pk=pk).delete()
        except QualityTarget.DoesNotExist:
            return Response({"detail": "No encontrado."}, status=404)
        return Response(status=204)
    
from datetime import date, timedelta
import io
from openpyxl import Workbook
from openpyxl.styles import Font, PatternFill, Alignment
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from django.http import HttpResponse
from apps.quality.services.qwall_service import QWallService


class QWallReportView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        today     = date.today()
        start_raw = request.query_params.get("start_date", str(today - timedelta(days=7)))
        end_raw   = request.query_params.get("end_date",   str(today))
        fmt       = request.query_params.get("export", "json")

        import logging
        logging.getLogger(__name__).warning(f"QWALL REQUEST: fmt={fmt} params={dict(request.query_params)}")

        try:
            start_date = date.fromisoformat(start_raw)
            end_date   = date.fromisoformat(end_raw)
        except ValueError:
            return Response({"error": "Formato de fecha inválido. Use YYYY-MM-DD."}, status=400)

        if end_date < start_date:
            return Response({"error": "end_date no puede ser anterior a start_date."}, status=400)

        if (end_date - start_date).days > 180:
            return Response({"error": "Rango máximo permitido: 180 días."}, status=400)

        data = QWallService.get_report(start_date, end_date)

        if fmt == "xlsx":
            try:
                xlsx = _build_excel(data, start_date, end_date)
                filename = f"qwall_{start_raw}_{end_raw}.xlsx"
                response = HttpResponse(
                    xlsx,
                    content_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
                )
                response["Content-Disposition"] = f'attachment; filename="{filename}"'
                response["X-Debug"] = "xlsx-branch-hit"
                return response
            except Exception as e:
                import traceback
                return Response({"error": str(e), "trace": traceback.format_exc()}, status=500)

        return Response(data)
# ── Excel builder ─────────────────────────────────────────────────────────────

HEADER_FILL = PatternFill(start_color="4472C4", end_color="4472C4", fill_type="solid")
HEADER_FONT = Font(bold=True, color="FFFFFF")
FAIL_FONT   = Font(color="FF0000", bold=True)
BOLD_LG     = Font(bold=True, size=12)
BOLD        = Font(bold=True)
CENTER      = Alignment(horizontal="center", vertical="center")


def _fmt_duration(seconds) -> str:
    if not seconds:
        return "0:00"
    s = int(seconds)
    return f"{s // 60}:{str(s % 60).zfill(2)}"


def _build_excel(data: dict, start_date: date, end_date: date) -> bytes:
    wb = Workbook()

    # ── Hoja 1: Resumen ───────────────────────────────────────────────────────
    ws_sum = wb.active
    ws_sum.title = "Resumen"

    summary = data["summary"]
    avg_dur = _fmt_duration(summary["avg_duration"])

    thin      = Side(style="thin", color="000000")
    border    = Border(left=thin, right=thin, top=thin, bottom=thin)
    title_fill = PatternFill(fill_type=None)
    alt_fill   = PatternFill(fill_type=None)
    no_fill    = PatternFill(fill_type=None)
    center     = Alignment(horizontal="center", vertical="center")
    left_align = Alignment(horizontal="left",   vertical="center")

    ws_sum.column_dimensions["A"].width = 28
    ws_sum.column_dimensions["B"].width = 26

    # Título merge A1:B1
    ws_sum.merge_cells("A1:B1")
    t           = ws_sum["A1"]
    t.value     = "Reporte de Inspecciones de Calidad"
    t.font      = Font(bold=True, size=12)
    t.fill      = title_fill
    t.alignment = center
    t.border    = border
    ws_sum.row_dimensions[1].height = 22

    rows_data = [
        ("Período",               f"{start_date} a {end_date}"),
        ("Generado",              dt.now().strftime("%Y-%m-%d %H:%M:%S")),
        ("Total de Inspecciones", summary["total"]),
        ("PASS",                  summary["pass"]),
        ("FAIL",                  summary["fail"]),
        ("Tasa de Aprobación",    f"{summary['pass_rate']:.2f}%"),
        ("Tiempo Promedio",       avg_dur),
        ("Inspectores Únicos",    summary["inspectors"]),
        ("Part Numbers Únicos",   summary["part_numbers"]),
    ]

    for i, (label, value) in enumerate(rows_data, start=2):
        ws_sum.row_dimensions[i].height = 18
        fill = alt_fill if i % 2 == 0 else no_fill

        a           = ws_sum.cell(row=i, column=1, value=label)
        a.font      = Font(size=10)
        a.alignment = center
        a.border    = border
        a.fill      = fill

        b           = ws_sum.cell(row=i, column=2, value=value)
        b.font      = Font(size=10)
        b.alignment = center
        b.border    = border
        b.fill      = fill

    # ── Hoja 2: Inspecciones (detalle) ────────────────────────────────────────
    ws = wb.create_sheet("Inspecciones")

    columns = [
        ("Fecha",        "inspection_date", 14),
        ("Semana",       "week_number",     10),
        ("Mes",          "month_name",      14),
        ("Hora Inicio",  "time_start",      12),
        ("Hora Fin",     "time_end",        12),
        ("Duración",     "_duration",       12),
        ("Inspector",    "inspector",       22),
        ("Tipo",         "inspection_type", 16),
        ("Resultado",    "result",          12),
        ("QTY",          "_qty",            8),
        ("WO",           "work_order",      14),
        ("Part Number",  "part_number",     20),
        ("Serial SSI",   "serial_ssi",      20),
        ("Serial Volvo", "serial_volvo",    20),
        ("Fallas",       "fail_modes",      40),
    ]

    # Headers
    for col_idx, (header, _, width) in enumerate(columns, start=1):
        cell = ws.cell(row=1, column=col_idx, value=header)
        cell.fill   = HEADER_FILL
        cell.font   = HEADER_FONT
        cell.alignment = CENTER
        ws.column_dimensions[ws.cell(row=1, column=col_idx).column_letter].width = width

    # Filas de datos
    rows = data.get("rows", [])
    for row_idx, r in enumerate(rows, start=2):
        values = []
        for _, field, _ in columns:
            if field == "_duration":
                values.append(_fmt_duration(r.get("duration_seconds")))
            elif field == "_qty":
                values.append(1)
            else:
                values.append(r.get(field, ""))

        for col_idx, val in enumerate(values, start=1):
            cell = ws.cell(row=row_idx, column=col_idx, value=val)
            # Colorear resultado
            if columns[col_idx - 1][0] == "Resultado":
                if val == "FAIL":
                    cell.font = FAIL_FONT
            # Fondo suave FAIL en toda la fila
            if r.get("result") == "FAIL":
                cell.fill = PatternFill(start_color="FFE5E5", end_color="FFE5E5", fill_type="solid")

    # ── Tabla pivote de fallas (columna Q en adelante) ────────────────────────
    fail_modes = data.get("fail_modes", [])
    if fail_modes:
        pivot_col = len(columns) + 2  # deja una columna de separación

        title_cell = ws.cell(row=1, column=pivot_col, value="ANÁLISIS DE FALLAS")
        title_cell.font = BOLD_LG

        hdr_falla = ws.cell(row=2, column=pivot_col,     value="Falla")
        hdr_cant  = ws.cell(row=2, column=pivot_col + 1, value="Cantidad")
        for cell in [hdr_falla, hdr_cant]:
            cell.fill      = HEADER_FILL
            cell.font      = HEADER_FONT
            cell.alignment = CENTER

        piv_col_letter      = ws.cell(row=1, column=pivot_col).column_letter
        piv_col_next_letter = ws.cell(row=1, column=pivot_col + 1).column_letter
        ws.column_dimensions[piv_col_letter].width      = 50
        ws.column_dimensions[piv_col_next_letter].width = 12

        for i, fm in enumerate(fail_modes, start=3):
            ws.cell(row=i, column=pivot_col,     value=fm["fail_mode"])
            ws.cell(row=i, column=pivot_col + 1, value=fm["count"])

        total_row = len(fail_modes) + 3
        total_cell = ws.cell(row=total_row, column=pivot_col, value="TOTAL")
        total_cell.font = BOLD_LG
        sum_cell = ws.cell(
            row=total_row, column=pivot_col + 1,
            value=f"=SUM({piv_col_next_letter}3:{piv_col_next_letter}{total_row - 1})"
        )
        sum_cell.font      = BOLD_LG
        sum_cell.alignment = CENTER

    # ── Output ────────────────────────────────────────────────────────────────
    buf = io.BytesIO()
    wb.save(buf)
    buf.seek(0)
    return buf.getvalue()