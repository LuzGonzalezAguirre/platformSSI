from dataclasses import dataclass, field
from typing import Callable, Any
from datetime import date, timedelta


@dataclass(frozen=True)
class ChatbotIntent:
    key: str
    service_call: Callable[[dict, dict], Any]
    output_fields: set[str] = field(default_factory=set)
    required_filters: set[str] = field(default_factory=set)


def _static(filters: dict, config: dict) -> dict:
    """Para preguntas response_type='text' sin variables — el texto vive
    completo en answer_template, no necesita datos de ningún Service."""
    return {}


def _get_pass_rate_today(filters: dict, config: dict) -> dict:
    from apps.quality.services.qwall_service import QWallService

    today = date.today()
    result = QWallService.get_report(
        start_date=today, end_date=today,
        bu_id=filters.get("bu_id"), locale=filters.get("locale", "es"),
    )
    summary = result["summary"]
    return {"pass_rate": summary["pass_rate"], "total_inspected": summary["total"]}


def _get_pass_rate_range(filters: dict, config: dict) -> dict:
    from apps.quality.services.qwall_service import QWallService

    end = date.today()
    start = end - timedelta(days=6)
    result = QWallService.get_report(
        start_date=start, end_date=end,
        bu_id=filters.get("bu_id"), locale=filters.get("locale", "es"),
    )
    summary = result["summary"]
    return {"pass_rate": summary["pass_rate"], "total_inspected": summary["total"]}


def _get_target_progress(filters: dict, config: dict) -> dict:
    from apps.quality.services.qwall_service import QWallService

    end = date.today()
    start = end - timedelta(days=6)
    target_pct = QWallService._get_pass_rate_target()
    result = QWallService.get_report(
        start_date=start, end_date=end,
        bu_id=filters.get("bu_id"), locale=filters.get("locale", "es"),
    )
    pass_rate = result["summary"]["pass_rate"]
    diff = round(pass_rate - target_pct, 2)
    status = "on_target" if pass_rate >= target_pct else "below_target"
    return {"pass_rate": pass_rate, "target_pct": target_pct, "diff": abs(diff), "status": status}


def _get_top_fail_mode(filters: dict, config: dict) -> dict:
    from apps.quality.services.qwall_service import QWallService

    end = date.today()
    start = end - timedelta(days=6)
    result = QWallService.get_pareto(
        start_date=start, end_date=end,
        bu_id=filters.get("bu_id"), locale=filters.get("locale", "es"), limit=1,
    )
    items = result["items"]
    if not items:
        return {"fail_mode_name": "-", "fail_count": 0, "fail_percentage": 0}
    top = items[0]
    return {
        "fail_mode_name": top["name"],
        "fail_count": top["count"],
        "fail_percentage": top["pct_of_total"],
    }


def _get_rejects_summary(filters: dict, config: dict) -> dict:
    """Rechazos de hoy y de los últimos 7 días — dos llamadas independientes
    porque get_report no acumula ventanas anidadas."""
    from apps.quality.services.qwall_service import QWallService

    today = date.today()
    week_start = today - timedelta(days=6)

    today_result = QWallService.get_report(
        start_date=today, end_date=today,
        bu_id=filters.get("bu_id"), locale=filters.get("locale", "es"),
    )
    week_result = QWallService.get_report(
        start_date=week_start, end_date=today,
        bu_id=filters.get("bu_id"), locale=filters.get("locale", "es"),
    )
    return {
        "rejects_today": today_result["summary"]["fail"],
        "rejects_week": week_result["summary"]["fail"],
    }


def _get_worst_part_number(filters: dict, config: dict) -> dict:
    """Parte con más fallas (conteo absoluto, no pass_rate) en los últimos 7
    días — usa by_part que ya trae fail count por parte."""
    from apps.quality.services.qwall_service import QWallService

    end = date.today()
    start = end - timedelta(days=6)
    result = QWallService.get_report(
        start_date=start, end_date=end,
        bu_id=filters.get("bu_id"), locale=filters.get("locale", "es"),
    )
    by_part = result["by_part"]
    if not by_part:
        return {"part_number": "-", "fail_count": 0}
    worst = max(by_part, key=lambda p: p["fail"])
    return {"part_number": worst["part_number"], "fail_count": worst["fail"]}


def _get_worst_inspection_point(filters: dict, config: dict) -> dict:
    from apps.quality.services.qwall_service import QWallService

    end = date.today()
    start = end - timedelta(days=6)
    result = QWallService.get_fail_by_point(
        start_date=start, end_date=end, bu_id=filters.get("bu_id"),
    )
    items = result["items"]
    if not items:
        return {"inspection_point_name": "-", "fail_count": 0, "pct_of_total_fails": 0}
    top = items[0]  # ya viene ordenado desc por fail_count
    return {
        "inspection_point_name": top["inspection_point_name"],
        "fail_count": top["fail_count"],
        "pct_of_total_fails": top["pct_of_total_fails"],
    }


def _get_pass_rate_today_vs_yesterday(filters: dict, config: dict) -> dict:
    from apps.quality.services.qwall_service import QWallService

    today = date.today()
    yesterday = today - timedelta(days=1)

    today_result = QWallService.get_report(
        start_date=today, end_date=today,
        bu_id=filters.get("bu_id"), locale=filters.get("locale", "es"),
    )
    yesterday_result = QWallService.get_report(
        start_date=yesterday, end_date=yesterday,
        bu_id=filters.get("bu_id"), locale=filters.get("locale", "es"),
    )
    today_rate = today_result["summary"]["pass_rate"]
    yesterday_rate = yesterday_result["summary"]["pass_rate"]
    diff = round(today_rate - yesterday_rate, 2)
    trend = "up" if diff > 0 else ("down" if diff < 0 else "flat")
    return {
        "pass_rate_today": today_rate,
        "pass_rate_yesterday": yesterday_rate,
        "diff": abs(diff),
        "trend": trend,
    }


def _get_best_worst_bu_today(filters: dict, config: dict) -> dict:
    from apps.quality.services.qwall_service import QWallService

    today = date.today()
    result = QWallService.get_bu_summary(start_date=today, end_date=today)
    items = result["items"]
    if not items:
        return {
            "best_bu_name": "-", "best_bu_pass_rate": 0,
            "worst_bu_name": "-", "worst_bu_pass_rate": 0,
        }
    best = max(items, key=lambda x: x["pass_rate"])
    worst = min(items, key=lambda x: x["pass_rate"])
    return {
        "best_bu_name": best["business_unit_name"],
        "best_bu_pass_rate": best["pass_rate"],
        "worst_bu_name": worst["business_unit_name"],
        "worst_bu_pass_rate": worst["pass_rate"],
    }


CHATBOT_SERVICE_REGISTRY: dict[str, ChatbotIntent] = {
    "qwall.pass_rate_today": ChatbotIntent(
        key="qwall.pass_rate_today",
        service_call=_get_pass_rate_today,
        output_fields={"pass_rate", "total_inspected"},
        required_filters=set(),
    ),
    "qwall.pass_rate_range": ChatbotIntent(
        key="qwall.pass_rate_range",
        service_call=_get_pass_rate_range,
        output_fields={"pass_rate", "total_inspected"},
        required_filters=set(),
    ),
    "qwall.target_progress": ChatbotIntent(
        key="qwall.target_progress",
        service_call=_get_target_progress,
        output_fields={"pass_rate", "target_pct", "diff", "status"},
        required_filters=set(),
    ),
    "qwall.top_fail_mode": ChatbotIntent(
        key="qwall.top_fail_mode",
        service_call=_get_top_fail_mode,
        output_fields={"fail_mode_name", "fail_count", "fail_percentage"},
        required_filters=set(),
    ),
    "qwall.rejects_summary": ChatbotIntent(
        key="qwall.rejects_summary",
        service_call=_get_rejects_summary,
        output_fields={"rejects_today", "rejects_week"},
        required_filters=set(),
    ),
    "qwall.worst_part_number": ChatbotIntent(
        key="qwall.worst_part_number",
        service_call=_get_worst_part_number,
        output_fields={"part_number", "fail_count"},
        required_filters=set(),
    ),
    "qwall.worst_inspection_point": ChatbotIntent(
        key="qwall.worst_inspection_point",
        service_call=_get_worst_inspection_point,
        output_fields={"inspection_point_name", "fail_count", "pct_of_total_fails"},
        required_filters=set(),
    ),
    "qwall.pass_rate_today_vs_yesterday": ChatbotIntent(
        key="qwall.pass_rate_today_vs_yesterday",
        service_call=_get_pass_rate_today_vs_yesterday,
        output_fields={"pass_rate_today", "pass_rate_yesterday", "diff", "trend"},
        required_filters=set(),
    ),
    "qwall.best_worst_bu_today": ChatbotIntent(
        key="qwall.best_worst_bu_today",
        service_call=_get_best_worst_bu_today,
        output_fields={"best_bu_name", "best_bu_pass_rate", "worst_bu_name", "worst_bu_pass_rate"},
        required_filters=set(),
    ),
    "qwall.static_semaforo": ChatbotIntent(
        key="qwall.static_semaforo",
        service_call=_static,
        output_fields=set(),
        required_filters=set(),
    ),
    "qwall.static_download_pdf": ChatbotIntent(
        key="qwall.static_download_pdf",
        service_call=_static,
        output_fields=set(),
        required_filters=set(),
    ),
}


def get_registry_choices() -> list[tuple[str, str]]:
    return [(key, key) for key in CHATBOT_SERVICE_REGISTRY.keys()]