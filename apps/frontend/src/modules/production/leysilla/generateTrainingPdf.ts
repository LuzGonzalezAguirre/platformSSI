import { PDFDocument, rgb, StandardFonts } from "pdf-lib";

interface BreakRecord {
  barcode_id: string;
  employee_name: string;
  check_in?: string;
  check_out?: string;
}

function parseBarcodeId(barcode: string): string {
  return (barcode ?? "").replace(/^9000/, "").replace(/A$/i, "");
}

function toHHMM(iso: string): string {
  return new Date(iso).toLocaleTimeString("es-MX", { hour: "2-digit", minute: "2-digit" });
}

// Columnas: centro X de cada columna para centrar el texto dentro de la celda.
// Ajustar si el texto no cae exactamente.
const COORDS = {
  tema:       { x: 88, y: 718 },
  fecha:      { x: 88, y: 701 },
  instructor: { x: 88, y: 683 },
  horario:    { x: 88, y: 665 },
  interno:    { x: 147, y: 647 },
  rfc:        { x: 375, y: 647 },
  prevenir:   { x: 551, y: 674 }, // X en casilla "PREVENIR RIESGOS DE TRABAJO"
  table: {
    empNumCenter: 63,
    nameX: 101,
    areaCenter: 322,
    rowStartY: 605,
    rowHeight: 14.8,
  },
};

export async function generateTrainingPdf(
  records: BreakRecord[],
  startDate: string,
  endDate: string,
) {
  // Horario: primera check_in y última check_out del periodo
  const checkIns  = records.map((r) => r.check_in).filter(Boolean) as string[];
  const checkOuts = records.map((r) => r.check_out).filter(Boolean) as string[];
  const horarioLabel = checkIns.length && checkOuts.length
    ? `${toHHMM(checkIns.reduce((a, b) => (a < b ? a : b)))} - ${toHHMM(checkOuts.reduce((a, b) => (a > b ? a : b)))}`
    : "";

  // Deduplicar por barcode_id para la tabla
  const seen = new Set<string>();
  const employees: BreakRecord[] = [];
  for (const r of records) {
    if (r.barcode_id && !seen.has(r.barcode_id)) {
      seen.add(r.barcode_id);
      employees.push(r);
    }
  }

  const dateLabel =
    startDate === endDate ? startDate : `${startDate} al ${endDate}`;

  const templateBytes = await fetch("/training-template.pdf.pdf").then((res) =>
    res.arrayBuffer(),
  );
  const pdfDoc = await PDFDocument.load(templateBytes);
  const page = pdfDoc.getPages()[0];
  const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const fontSize = 7.5;

  const draw = (text: string, x: number, y: number) =>
    page.drawText(text, { x, y, size: fontSize, font, color: rgb(0, 0, 0) });

  const drawCentered = (text: string, colCenterX: number, y: number) => {
    const w = font.widthOfTextAtSize(text, fontSize);
    draw(text, colCenterX - w / 2, y);
  };

  draw("Aplicación de la ley silla en la jornada laboral", COORDS.tema.x, COORDS.tema.y);
  draw(dateLabel, COORDS.fecha.x, COORDS.fecha.y);
  draw("Aldo Garete", COORDS.instructor.x, COORDS.instructor.y);
  if (horarioLabel) draw(horarioLabel, COORDS.horario.x, COORDS.horario.y);
  draw("X",  COORDS.interno.x,  COORDS.interno.y);
  draw("N/A", COORDS.rfc.x,     COORDS.rfc.y);
  draw("X",  COORDS.prevenir.x, COORDS.prevenir.y);

  const { empNumCenter, nameX, areaCenter, rowStartY, rowHeight } = COORDS.table;
  const MAX_ROWS = 33;

  for (let i = 0; i < MAX_ROWS; i++) {
    const emp = employees[i];
    if (!emp) break;
    const y = rowStartY - i * rowHeight + 3;
    drawCentered(parseBarcodeId(emp.barcode_id), empNumCenter, y);
    draw(emp.employee_name.toUpperCase(), nameX, y);
    drawCentered("SSI", areaCenter, y);
  }

  const pdfBytes = await pdfDoc.save();
  const blob = new Blob([pdfBytes.buffer as ArrayBuffer], { type: "application/pdf" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `entrenamiento_${dateLabel}.pdf`;
  a.click();
  URL.revokeObjectURL(url);
}
