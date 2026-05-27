"""
PDF report generator for Ley Silla NOM-036 using reportlab.
"""
from datetime import date
from io import BytesIO

from reportlab.lib import colors
from reportlab.lib.pagesizes import letter
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.units import inch
from reportlab.platypus import (
    SimpleDocTemplate, Table, TableStyle, Paragraph, Spacer, HRFlowable,
)
from reportlab.lib.enums import TA_CENTER, TA_LEFT

from apps.ssi_common.db import execute_query


BRAND_BLUE = colors.HexColor("#0070C0")
BRAND_GREEN = colors.HexColor("#00B050")
LIGHT_GRAY = colors.HexColor("#F2F2F2")
MID_GRAY = colors.HexColor("#BFBFBF")


def _fetch_report_data(start_date: date, end_date: date, turno: str | None, department: str | None) -> list[dict]:
    filters = ["cu.check_out IS NOT NULL", "cu.check_in >= ?", "cu.check_in < DATEADD(DAY, 1, CAST(? AS DATETIME))"]
    params: list = [start_date, end_date]
    if turno:
        filters.append("e.turno = ?")
        params.append(turno)
    if department:
        filters.append("e.department = ?")
        params.append(department)

    rows = execute_query(
        f"""
        SELECT
            e.barcode_id, e.name AS employee_name, e.turno, e.department,
            cu.chair_number, cu.check_in, cu.check_out,
            DATEDIFF(MINUTE, cu.check_in, cu.check_out) AS duration_min,
            cu.released_by
        FROM ssi_ChairUsage cu
        INNER JOIN ssi_production_employee e ON cu.employee_id = e.id
        WHERE {" AND ".join(filters)}
        ORDER BY e.name, cu.check_in
        """,
        tuple(params),
    )
    return rows


def _group_by_employee(rows: list[dict]) -> list[dict]:
    employees: dict[str, dict] = {}
    for r in rows:
        key = r["barcode_id"]
        if key not in employees:
            employees[key] = {
                "barcode_id": r["barcode_id"],
                "employee_name": r["employee_name"],
                "turno": r["turno"],
                "department": r["department"],
                "total_breaks": 0,
                "total_minutes": 0,
            }
        employees[key]["total_breaks"] += 1
        employees[key]["total_minutes"] += r["duration_min"] or 0

    result = []
    for emp in employees.values():
        tm = emp["total_minutes"]
        emp["total_hours_str"] = f"{tm // 60}h {tm % 60}m"
        avg = tm // emp["total_breaks"] if emp["total_breaks"] else 0
        emp["avg_break_str"] = f"{avg} min"
        result.append(emp)
    return sorted(result, key=lambda x: x["employee_name"])


def generate_pdf(
    start_date: date,
    end_date: date,
    turno: str | None,
    department: str | None,
    generated_by: str = "Sistema",
) -> bytes:
    rows = _fetch_report_data(start_date, end_date, turno, department)
    employees = _group_by_employee(rows)

    buffer = BytesIO()
    doc = SimpleDocTemplate(
        buffer,
        pagesize=letter,
        leftMargin=0.75 * inch,
        rightMargin=0.75 * inch,
        topMargin=0.75 * inch,
        bottomMargin=0.75 * inch,
    )

    styles = getSampleStyleSheet()
    title_style = ParagraphStyle("title", parent=styles["Title"], textColor=BRAND_BLUE, fontSize=14, spaceAfter=4)
    subtitle_style = ParagraphStyle("subtitle", parent=styles["Normal"], fontSize=9, textColor=colors.grey, spaceAfter=2)
    small = ParagraphStyle("small", parent=styles["Normal"], fontSize=8)
    header_cell = ParagraphStyle("hc", parent=styles["Normal"], fontSize=8, textColor=colors.white, alignment=TA_CENTER)

    story = []

    # ── Header ────────────────────────────────────────────────────────────────
    story.append(Paragraph("REPORTE DE DESCANSOS - Ley Silla NOM-036", title_style))
    story.append(Paragraph(f"Período: {start_date} al {end_date}", subtitle_style))

    filters_applied = []
    if turno:
        filters_applied.append(f"Turno: {turno}")
    if department:
        filters_applied.append(f"Departamento: {department}")
    if filters_applied:
        story.append(Paragraph("Filtros: " + "  |  ".join(filters_applied), subtitle_style))

    story.append(HRFlowable(width="100%", thickness=1, color=BRAND_BLUE, spaceAfter=8))

    # ── Summary line ──────────────────────────────────────────────────────────
    story.append(Paragraph(
        f"Total de empleados: {len(employees)}   |   Total de descansos: {len(rows)}",
        ParagraphStyle("sum", parent=styles["Normal"], fontSize=9, spaceBefore=2, spaceAfter=10),
    ))

    # ── Per-employee table ────────────────────────────────────────────────────
    col_widths = [1.8 * inch, 1.1 * inch, 0.5 * inch, 0.9 * inch, 1.0 * inch, 0.8 * inch, 1.5 * inch]
    table_header = [
        Paragraph(h, header_cell)
        for h in ["Nombre", "Código", "Turno", "Descansos", "Total Tiempo", "Promedio", "Firma"]
    ]

    data = [table_header]
    for emp in employees:
        data.append([
            Paragraph(emp["employee_name"], small),
            emp["barcode_id"],
            emp["turno"],
            str(emp["total_breaks"]),
            emp["total_hours_str"],
            emp["avg_break_str"],
            Paragraph("______________________", small),
        ])

    table = Table(data, colWidths=col_widths, repeatRows=1)
    table.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, 0), BRAND_BLUE),
        ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
        ("FONTSIZE", (0, 0), (-1, 0), 8),
        ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
        ("ALIGN", (0, 0), (-1, -1), "CENTER"),
        ("ALIGN", (0, 1), (0, -1), "LEFT"),
        ("FONTSIZE", (0, 1), (-1, -1), 8),
        ("ROWBACKGROUNDS", (0, 1), (-1, -1), [colors.white, LIGHT_GRAY]),
        ("GRID", (0, 0), (-1, -1), 0.3, MID_GRAY),
        ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
        ("TOPPADDING", (0, 0), (-1, -1), 4),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 4),
    ]))
    story.append(table)

    story.append(Spacer(1, 20))
    story.append(HRFlowable(width="100%", thickness=0.5, color=MID_GRAY))
    story.append(Spacer(1, 4))
    story.append(Paragraph(
        f"Generado el {date.today()}  |  Por: {generated_by}",
        ParagraphStyle("footer", parent=styles["Normal"], fontSize=7, textColor=colors.grey, alignment=TA_CENTER),
    ))

    def _add_page_number(canvas, doc):
        canvas.saveState()
        canvas.setFont("Helvetica", 7)
        canvas.setFillColor(colors.grey)
        canvas.drawRightString(
            letter[0] - 0.75 * inch,
            0.5 * inch,
            f"Página {doc.page}",
        )
        canvas.restoreState()

    doc.build(story, onFirstPage=_add_page_number, onLaterPages=_add_page_number)
    return buffer.getvalue()
