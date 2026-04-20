# apps/backend/apps/production/services/ops_pdf_service.py

from datetime import date, timedelta
from io import BytesIO
from django.template.loader import render_to_string
try:
    from weasyprint import HTML, CSS
except (ImportError, OSError):
    HTML = None
    CSS  = None
from apps.production.services.ops_report_service import OpsReportService
from apps.production.repositories.safety_repository import SafetyRepository


DAY_LABELS = ["Lun", "Mar", "Mié", "Jue", "Vie"]


def generate_daily_pdf(report_date: date) -> BytesIO:
    summary  = OpsReportService.get_daily_summary(report_date)
    safety   = SafetyRepository.get_settings("Tijuana")
    monday   = report_date - timedelta(days=report_date.weekday())

    bu_tables = {}
    for bu in ("volvo", "cummins", "tulc"):
        bu_tables[bu] = OpsReportService.get_weekly_table(report_date, bu, "daily")

    context = _build_context(report_date, summary, safety, bu_tables, monday)

    html_str = render_to_string("pdf/ops_daily_report.html", context)
    pdf_file = BytesIO()
    HTML(string=html_str, base_url="/").write_pdf(pdf_file)
    pdf_file.seek(0)
    return pdf_file


def _build_context(report_date, summary, safety, bu_tables, monday):
    date_display = report_date.strftime("%d/%m/%Y")

    clients = []
    for bu_key, bu_label in [("volvo", "VOLVO"), ("cummins", "CUMMINS"), ("tulc", "TULC")]:
        data   = summary.get(bu_key, {})
        table  = bu_tables[bu_key]
        periods = table.get("periods", [])[:5]
        totals  = table.get("totals", {})

        day_labels    = []
        produced_data = []
        target_data   = []
        wip_actual    = []
        wip_goal      = []
        cum_produced  = []
        cum_target    = []
        scrap_cum     = []

        for i, p in enumerate(periods):
            day_labels.append(DAY_LABELS[i] if i < len(DAY_LABELS) else f"D{i+1}")
            produced_data.append(p.get("produced") or 0)
            target_data.append(p.get("target") or 0)
            wip_actual.append(p.get("wip_actual") or 0)
            wip_goal.append(p.get("wip_goal") or 0)
            cum_produced.append(p.get("cum_produced") or 0)
            cum_target.append(p.get("cum_target") or 0)
            scrap_cum.append(p.get("scrap_cogp_cum") or 0)

        max_prod    = max(max(produced_data + target_data, default=1), 1)
        max_wip     = max(max(wip_actual + wip_goal, default=1), 1)
        max_cum     = max(max(cum_produced + cum_target, default=1), 1)
        max_scrap   = max(max(scrap_cum, default=0.01), 0.01)

        clients.append({
            "key":    bu_key,
            "label":  bu_label,
            "data":   data,
            "periods": periods,
            "totals":  totals,
            "charts": {
                "day_labels":    day_labels,
                "produced":      produced_data,
                "target":        target_data,
                "wip_actual":    wip_actual,
                "wip_goal":      wip_goal,
                "cum_produced":  cum_produced,
                "cum_target":    cum_target,
                "scrap_cum":     scrap_cum,
                "max_prod":      max_prod,
                "max_wip":       max_wip,
                "max_cum":       max_cum,
                "max_scrap":     max_scrap,
                "svg_prod_target": _svg_bar_chart(produced_data, target_data, day_labels),
                "svg_wip":         _svg_bar_chart(wip_actual, wip_goal, day_labels),
                "svg_cum":         _svg_line_chart(cum_produced, cum_target, day_labels),
                "svg_scrap":       _svg_line_chart(
                    scrap_cum, [0] * len(day_labels),
                    day_labels,
                    color_a="#ef4444", color_b="transparent",
                    label_a="Scrap COGP%", label_b="")
            },
        })

    return {
        "report_date":   date_display,
        "safety_days":   safety.days_without_incident,
        "summary":       summary,
        "clients":       clients,
    }

def _svg_bar_chart(produced: list, target: list, labels: list, 
                   width=240, height=120) -> str:
    W, H = width, height
    pad_l, pad_r, pad_t, pad_b = 28, 8, 10, 22
    chart_w = W - pad_l - pad_r
    chart_h = H - pad_t - pad_b
    n       = len(labels)
    max_val = max(max(produced + target, default=1), 1)
    bar_w   = (chart_w / n) * 0.35

    lines = [f'<svg viewBox="0 0 {W} {H}" width="{W}" height="{H}" '
             f'xmlns="http://www.w3.org/2000/svg">']

    # Y gridlines
    for pct in [0, 0.25, 0.5, 0.75, 1.0]:
        y = pad_t + chart_h * (1 - pct)
        val = int(max_val * pct)
        lines.append(f'<line x1="{pad_l}" y1="{y:.1f}" x2="{W-pad_r}" y2="{y:.1f}" '
                     f'stroke="#e2e8f0" stroke-width="0.5"/>')
        lines.append(f'<text x="{pad_l-3}" y="{y+3:.1f}" text-anchor="end" '
                     f'font-size="6" fill="#94a3b8">{val}</text>')

    # Bars
    slot_w = chart_w / n
    for i in range(n):
        x_center = pad_l + slot_w * i + slot_w / 2
        # Target bar (background)
        t_h = (target[i] / max_val) * chart_h if max_val > 0 else 0
        t_y = pad_t + chart_h - t_h
        lines.append(f'<rect x="{x_center-bar_w:.1f}" y="{t_y:.1f}" '
                     f'width="{bar_w:.1f}" height="{t_h:.1f}" fill="#cbd5e1" rx="1"/>')
        # Produced bar
        p_h = (produced[i] / max_val) * chart_h if max_val > 0 else 0
        p_y = pad_t + chart_h - p_h
        lines.append(f'<rect x="{x_center:.1f}" y="{p_y:.1f}" '
                     f'width="{bar_w:.1f}" height="{p_h:.1f}" fill="#3b82f6" rx="1"/>')
        # Label
        lines.append(f'<text x="{x_center:.1f}" y="{H-6}" text-anchor="middle" '
                     f'font-size="6.5" fill="#64748b">{labels[i]}</text>')

    # Legend
    lines.append(f'<rect x="{pad_l}" y="{H-14}" width="7" height="5" fill="#3b82f6"/>')
    lines.append(f'<text x="{pad_l+9}" y="{H-10}" font-size="6" fill="#64748b">Producido</text>')
    lines.append(f'<rect x="{pad_l+55}" y="{H-14}" width="7" height="5" fill="#cbd5e1"/>')
    lines.append(f'<text x="{pad_l+64}" y="{H-10}" font-size="6" fill="#64748b">Target</text>')

    lines.append('</svg>')
    return ''.join(lines)


def _svg_line_chart(series_a: list, series_b: list, labels: list,
                    color_a="#3b82f6", color_b="#94a3b8",
                    label_a="Producido", label_b="Goal",
                    width=240, height=120) -> str:
    W, H = width, height
    pad_l, pad_r, pad_t, pad_b = 30, 8, 10, 22
    chart_w = W - pad_l - pad_r
    chart_h = H - pad_t - pad_b
    n       = len(labels)
    max_val = max(max(series_a + series_b, default=1), 1)

    def px(i): return pad_l + (i / max(n-1, 1)) * chart_w
    def py(v): return pad_t + chart_h * (1 - v / max_val)

    lines = [f'<svg viewBox="0 0 {W} {H}" width="{W}" height="{H}" '
             f'xmlns="http://www.w3.org/2000/svg">']

    for pct in [0, 0.25, 0.5, 0.75, 1.0]:
        y   = pad_t + chart_h * (1 - pct)
        val = int(max_val * pct)
        lines.append(f'<line x1="{pad_l}" y1="{y:.1f}" x2="{W-pad_r}" y2="{y:.1f}" '
                     f'stroke="#e2e8f0" stroke-width="0.5"/>')
        lines.append(f'<text x="{pad_l-3}" y="{y+3:.1f}" text-anchor="end" '
                     f'font-size="6" fill="#94a3b8">{val}</text>')

    for series, color in [(series_b, color_b), (series_a, color_a)]:
        if n < 2:
            continue
        pts = " ".join(f"{px(i):.1f},{py(series[i]):.1f}" for i in range(n))
        lines.append(f'<polyline points="{pts}" fill="none" stroke="{color}" '
                     f'stroke-width="1.5" stroke-linejoin="round"/>')
        for i in range(n):
            lines.append(f'<circle cx="{px(i):.1f}" cy="{py(series[i]):.1f}" '
                         f'r="2.5" fill="{color}"/>')

    for i in range(n):
        lines.append(f'<text x="{px(i):.1f}" y="{H-6}" text-anchor="middle" '
                     f'font-size="6.5" fill="#64748b">{labels[i]}</text>')

    lines.append(f'<rect x="{pad_l}" y="{H-14}" width="7" height="4" fill="{color_a}"/>')
    lines.append(f'<text x="{pad_l+9}" y="{H-10}" font-size="6" fill="#64748b">{label_a}</text>')
    lines.append(f'<rect x="{pad_l+55}" y="{H-14}" width="7" height="4" fill="{color_b}"/>')
    lines.append(f'<text x="{pad_l+64}" y="{H-10}" font-size="6" fill="#64748b">{label_b}</text>')

    lines.append('</svg>')
    return ''.join(lines)