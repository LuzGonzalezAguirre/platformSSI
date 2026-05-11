# apps/backend/apps/quality/services/rejection_pdf_service.py

import base64
import io
from datetime import datetime
from reportlab.lib.pagesizes import letter
from reportlab.lib import colors
from reportlab.lib.units import inch
from reportlab.platypus import (
    SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle, Image, HRFlowable
)
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.enums import TA_LEFT, TA_CENTER


RED      = colors.HexColor("#ef4444")
DARK     = colors.HexColor("#111827")
GRAY     = colors.HexColor("#6b7280")
LIGHT_BG = colors.HexColor("#fef2f2")
BORDER   = colors.HexColor("#e5e7eb")


def build_rejection_pdf(tree: list[dict], start_date: str, end_date: str) -> bytes:
    buffer = io.BytesIO()
    doc = SimpleDocTemplate(
        buffer,
        pagesize=letter,
        leftMargin=0.75 * inch,
        rightMargin=0.75 * inch,
        topMargin=0.75 * inch,
        bottomMargin=0.75 * inch,
    )

    styles = getSampleStyleSheet()
    title_style = ParagraphStyle(
        "Title", parent=styles["Normal"],
        fontSize=16, fontName="Helvetica-Bold",
        textColor=DARK, spaceAfter=4,
    )
    subtitle_style = ParagraphStyle(
        "Subtitle", parent=styles["Normal"],
        fontSize=9, fontName="Helvetica",
        textColor=GRAY, spaceAfter=16,
    )
    fm_style = ParagraphStyle(
        "FMHeader", parent=styles["Normal"],
        fontSize=11, fontName="Helvetica-Bold",
        textColor=DARK,
    )
    code_style = ParagraphStyle(
        "Code", parent=styles["Normal"],
        fontSize=8, fontName="Helvetica",
        textColor=RED,
    )
    sn_style = ParagraphStyle(
        "SN", parent=styles["Normal"],
        fontSize=9, fontName="Helvetica-Bold",
        textColor=DARK,
    )
    detail_style = ParagraphStyle(
        "Detail", parent=styles["Normal"],
        fontSize=8, fontName="Helvetica",
        textColor=GRAY,
    )

    total = sum(n["count"] for n in tree)
    story = []

    # ── Portada / Header ──────────────────────────────────────────────────────
    story.append(Paragraph("Reporte de Piezas Rechazadas", title_style))
    story.append(Paragraph(
        f"Período: {start_date} — {end_date}  ·  "
        f"Total rechazos: {total}  ·  "
        f"Modos de falla: {len(tree)}  ·  "
        f"Generado: {datetime.now().strftime('%Y-%m-%d %H:%M')}",
        subtitle_style,
    ))
    story.append(HRFlowable(width="100%", thickness=1, color=BORDER, spaceAfter=16))

    # ── Árbol: fail mode → serials ────────────────────────────────────────────
    for node in tree:
        # Header fail mode
        header_data = [[
            Paragraph(node["fail_code"], code_style),
            Paragraph(node["fail_description"], fm_style),
            Paragraph(str(node["count"]), ParagraphStyle(
                "Count", parent=styles["Normal"],
                fontSize=10, fontName="Helvetica-Bold", textColor=RED,
            )),
        ]]
        header_table = Table(header_data, colWidths=[1.1 * inch, 5.0 * inch, 0.6 * inch])
        header_table.setStyle(TableStyle([
            ("BACKGROUND",  (0, 0), (-1, -1), LIGHT_BG),
            ("ROWBACKGROUNDS", (0, 0), (-1, -1), [LIGHT_BG]),
            ("BOX",         (0, 0), (-1, -1), 0.5, RED),
            ("VALIGN",      (0, 0), (-1, -1), "MIDDLE"),
            ("TOPPADDING",  (0, 0), (-1, -1), 6),
            ("BOTTOMPADDING", (0, 0), (-1, -1), 6),
            ("LEFTPADDING", (0, 0), (-1, -1), 8),
        ]))
        story.append(header_table)
        story.append(Spacer(1, 6))

        # Serials dentro del fail mode
        for serial in node["serials"]:
            for insp in serial["inspections"]:
                sn    = serial["serial_number"] or f"WO-{insp['work_order']}" or "—"
                fecha = insp["started_at"][:16].replace("T", " ")

                # Row SN + detalles
                detail_text = (
                    f"BU: {insp['bu_name']}  ·  "
                    f"Punto: {insp['point_name']}  ·  "
                    f"Inspector: {insp['inspector_name']}  ·  "
                    f"Fecha: {fecha}  ·  "
                    f"WO: {insp['work_order']}"
                )
                sn_data = [[
                    Paragraph(sn, sn_style),
                    Paragraph(detail_text, detail_style),
                ]]
                sn_table = Table(sn_data, colWidths=[1.6 * inch, 5.1 * inch])
                sn_table.setStyle(TableStyle([
                    ("VALIGN",        (0, 0), (-1, -1), "TOP"),
                    ("TOPPADDING",    (0, 0), (-1, -1), 5),
                    ("BOTTOMPADDING", (0, 0), (-1, -1), 5),
                    ("LEFTPADDING",   (0, 0), (0, -1),  16),
                    ("LINEBELOW",     (0, 0), (-1, -1), 0.3, BORDER),
                ]))
                story.append(sn_table)

                # Foto si existe
                if insp.get("photo_b64"):
                    try:
                        img_data = base64.b64decode(insp["photo_b64"])
                        img_buf  = io.BytesIO(img_data)
                        img      = Image(img_buf, width=3.5 * inch, height=2.5 * inch)
                        img.hAlign = "LEFT"

                        photo_data = [["", img]]
                        photo_table = Table(photo_data, colWidths=[0.4 * inch, 6.3 * inch])
                        photo_table.setStyle(TableStyle([
                            ("LEFTPADDING",   (0, 0), (-1, -1), 16),
                            ("TOPPADDING",    (0, 0), (-1, -1), 4),
                            ("BOTTOMPADDING", (0, 0), (-1, -1), 8),
                        ]))
                        story.append(photo_table)
                    except Exception:
                        pass

        story.append(Spacer(1, 14))

    doc.build(story)
    buffer.seek(0)
    return buffer.read()