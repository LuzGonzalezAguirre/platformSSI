"""COGP scrap offender staging into CCS through qwall-proxy."""
import hashlib
import logging
from datetime import datetime, timedelta, date
from decimal import Decimal
from zoneinfo import ZoneInfo

import requests
from django.conf import settings

from apps.quality.cogp.models import CogpSettings
from apps.quality.cogp.repositories.cogp_repository import CogpRepository
from apps.quality.cogp.services.cogp_pareto_service import (
    CogpParetoService,
    _date_windows,
    _resolve_bu_for_pareto_production,
    _resolve_bu_for_pareto_scrap,
)
from apps.quality.cogp.services.scrap_rate_service import _to_int_qty
from apps.quality.models import BusinessUnit
from apps.quality.services.plex_client_quality import QualityPlexClient

logger = logging.getLogger(__name__)


def last_workweek(now=None):
    today = (now or datetime.now(ZoneInfo("America/Tijuana"))).date()
    monday = today - timedelta(days=today.weekday())
    if today.weekday() < 5:
        monday -= timedelta(days=7)
    return monday, monday + timedelta(days=4)


def _source_key(payload):
    required = ("week_start", "week_end", "business_unit", "workcenter", "part_no", "reason")
    identity = [str(payload[key]).strip().casefold() for key in required]
    if payload.get("is_test"):
        identity.append(str(payload.get("test_run_id") or ""))
    return hashlib.sha256("\x1f".join(identity).encode()).hexdigest()


def stage(payload):
    source_key = _source_key(payload)
    proxy_url = settings.QWALL_PROXY_URL.rstrip("/")
    token = settings.QWALL_PROXY_TOKEN
    logger.info("COGP scrap staging via qwall-proxy url=%s token_configured=%s", proxy_url, bool(token))
    if not token:
        raise RuntimeError("QWALL_PROXY_TOKEN no está configurado.")

    request_kwargs = {
        "json": {**payload, "source_key": source_key},
        "headers": {"Authorization": f"Bearer {token}"},
        "timeout": 30,
    }

    try:
        response = requests.post(f"{proxy_url}/scrap-offenders/stage", **request_kwargs)
    except requests.RequestException:
        if "host.docker.internal" not in proxy_url:
            raise
        local_url = "http://127.0.0.1:8002"
        logger.info("COGP qwall-proxy retry via local Windows url=%s", local_url)
        response = requests.post(f"{local_url}/scrap-offenders/stage", **request_kwargs)

    logger.info("COGP qwall-proxy response status=%s", response.status_code)
    response.raise_for_status()
    return response.json()


def manual_test(data):
    start, end = last_workweek()
    cfg = CogpSettings.get_solo()
    cost = Decimal(str(data["scrap_cost"]))
    production_cost = Decimal(str(data["production_cost"]))
    scrap_qty = int(data["scrap_qty"])
    produced_qty = int(data["produced_qty"])
    if min(cost, production_cost, scrap_qty, produced_qty) < 0:
        raise ValueError("Los valores deben ser positivos.")
    cost_rate = cost / production_cost * 100 if production_cost > 0 else Decimal("0")
    piece_rate = (
        Decimal(scrap_qty) / Decimal(scrap_qty + produced_qty) * 100
        if scrap_qty + produced_qty
        else Decimal("0")
    )
    cost_offender = production_cost > 0 and cost_rate > cfg.cost_target_pct
    pieces_offender = scrap_qty + produced_qty > 0 and piece_rate > cfg.pieces_target_pct
    if not cost_offender and not pieces_offender:
        raise ValueError("La prueba debe rebasar al menos una meta.")

    return stage(
        {
            "week_start": start.isoformat(),
            "week_end": end.isoformat(),
            "business_unit": data["business_unit"],
            "workcenter": data["workcenter"],
            "part_no": data["part_no"],
            "part_name": data.get("part_name", ""),
            "reason": data["reason"],
            "scrap_cost": str(cost),
            "scrap_qty": scrap_qty,
            "total_scrap_cost": str(cost),
            "total_scrap_qty": scrap_qty,
            "production_cost": str(production_cost),
            "produced_qty": produced_qty,
            "cost_rate_pct": str(cost_rate),
            "pieces_rate_pct": str(piece_rate),
            "cost_target_pct": str(cfg.cost_target_pct),
            "pieces_target_pct": str(cfg.pieces_target_pct),
            "cost_offender": cost_offender,
            "pieces_offender": pieces_offender,
            "is_test": True,
            "test_run_id": str(data["test_run_id"]),
        }
    )


def stage_current_offenders(
    start_date: date,
    end_date: date,
    workcenter_filter: tuple[str, ...] = (),
) -> dict:
    """Stage every real scrap component for BUs currently above either target.

    The BU-level totals determine whether a BU is red. Each staged row keeps the
    individual part/workcenter/reason scrap contribution while carrying the same
    BU totals used to calculate the red condition.
    """
    if end_date < start_date:
        raise ValueError("end_date debe ser mayor o igual a start_date.")

    span_days = (end_date - start_date).days + 1
    max_span_days = CogpParetoService.CHUNK_DAYS * CogpParetoService.MAX_FETCH_CHUNKS
    if span_days > max_span_days:
        raise ValueError(
            f"El rango cubre {span_days} dias y el maximo es {max_span_days}. Reduce el periodo."
        )

    cfg = CogpSettings.get_solo()
    client = QualityPlexClient()
    repository = CogpRepository()
    part_to_bu = repository.get_all_part_to_bu_map()
    cost_model_key = client.get_cogp_cost_model()["cost_model_key"]
    wc_filter_set = set(workcenter_filter) if workcenter_filter else None

    scrap_rows: list[dict] = []
    production_rows: list[dict] = []
    quantity_production_rows: list[dict] = []
    for window_start, window_end in _date_windows(
        start_date, end_date, CogpParetoService.CHUNK_DAYS
    ):
        scrap_rows.extend(
            client.get_cogp_scrap_range(window_start.isoformat(), window_end.isoformat())
        )
        production_rows.extend(
            client.get_cogp_production_range(
                window_start.isoformat(), window_end.isoformat(), cost_model_key
            )
        )
        quantity_production_rows.extend(
            client.get_cogp_production_quantity_range(
                window_start.isoformat(), window_end.isoformat()
            )
        )

    if scrap_rows and "Quantity" not in scrap_rows[0]:
        raise ValueError("El proxy de Plex no devuelve Quantity para calcular ofensores por piezas.")

    all_bus = (
        BusinessUnit.VOLVO,
        BusinessUnit.CUMMINS,
        BusinessUnit.TULC,
        BusinessUnit.JOHN_DEERE,
        BusinessUnit.EATON,
    )
    total_scrap_cost = {bu: Decimal("0") for bu in all_bus}
    total_scrap_qty = {bu: 0 for bu in all_bus}
    production_cost = {bu: Decimal("0") for bu in all_bus}
    produced_qty = {bu: 0 for bu in all_bus}
    component_rows: dict[tuple[str, str, str, str], dict] = {}

    for row in scrap_rows:
        wc = row.get("Workcenter") or ""
        if wc_filter_set is not None and wc not in wc_filter_set:
            continue
        bu = _resolve_bu_for_pareto_scrap(
            row.get("Workcenter_Group"),
            wc,
            row.get("Part_No"),
            part_to_bu,
        )
        if bu not in total_scrap_cost:
            continue

        part_no = str(row.get("Part_No") or "").strip()
        reason = str(row.get("Scrap_Reason") or "Sin Razon").strip()
        cost = Decimal(str(row.get("Extended_Cost") or 0))
        qty = _to_int_qty(row.get("Quantity"))

        total_scrap_cost[bu] += cost
        total_scrap_qty[bu] += qty

        key = (bu, wc, part_no, reason)
        item = component_rows.setdefault(
            key,
            {
                "business_unit": bu,
                "workcenter": wc,
                "part_no": part_no,
                "part_name": "",
                "reason": reason,
                "scrap_cost": Decimal("0"),
                "scrap_qty": 0,
            },
        )
        item["scrap_cost"] += cost
        item["scrap_qty"] += qty

    for row in production_rows:
        wc = row.get("Workcenter") or ""
        if wc_filter_set is not None and wc not in wc_filter_set:
            continue
        bu = _resolve_bu_for_pareto_production(
            wc,
            row.get("Workcenter_Group"),
            row.get("Part_No"),
            part_to_bu,
        )
        if bu in production_cost:
            production_cost[bu] += Decimal(str(row.get("Extended_Cost") or 0))

    for row in quantity_production_rows:
        wc = row.get("Workcenter") or ""
        if wc_filter_set is not None and wc not in wc_filter_set:
            continue
        bu = _resolve_bu_for_pareto_scrap(
            row.get("Workcenter_Group"),
            wc,
            row.get("Part_No"),
            part_to_bu,
        )
        if bu in produced_qty:
            produced_qty[bu] += _to_int_qty(row.get("Quantity"))

    red_bus: dict[str, dict] = {}
    for bu in all_bus:
        cost_rate = (
            total_scrap_cost[bu] / production_cost[bu] * 100
            if production_cost[bu] > 0
            else Decimal("0")
        )
        piece_denominator = total_scrap_qty[bu] + produced_qty[bu]
        piece_rate = (
            Decimal(total_scrap_qty[bu]) / Decimal(piece_denominator) * 100
            if piece_denominator > 0
            else Decimal("0")
        )
        cost_offender = production_cost[bu] > 0 and cost_rate > cfg.cost_target_pct
        pieces_offender = piece_denominator > 0 and piece_rate > cfg.pieces_target_pct
        if cost_offender or pieces_offender:
            red_bus[bu] = {
                "cost_rate": cost_rate,
                "piece_rate": piece_rate,
                "cost_offender": cost_offender,
                "pieces_offender": pieces_offender,
            }

    staged = []
    for item in component_rows.values():
        bu = item["business_unit"]
        status = red_bus.get(bu)
        if not status:
            continue
        if item["scrap_cost"] <= 0 and item["scrap_qty"] <= 0:
            continue

        staged.append(
            stage(
                {
                    "week_start": start_date.isoformat(),
                    "week_end": end_date.isoformat(),
                    "business_unit": bu,
                    "workcenter": item["workcenter"],
                    "part_no": item["part_no"] or "SIN_PARTE",
                    "part_name": item["part_name"],
                    "reason": item["reason"],
                    "scrap_cost": str(item["scrap_cost"]),
                    "scrap_qty": item["scrap_qty"],
                    "total_scrap_cost": str(total_scrap_cost[bu]),
                    "total_scrap_qty": total_scrap_qty[bu],
                    "production_cost": str(production_cost[bu]),
                    "produced_qty": produced_qty[bu],
                    "cost_rate_pct": str(status["cost_rate"]),
                    "pieces_rate_pct": str(status["piece_rate"]),
                    "cost_target_pct": str(cfg.cost_target_pct),
                    "pieces_target_pct": str(cfg.pieces_target_pct),
                    "cost_offender": status["cost_offender"],
                    "pieces_offender": status["pieces_offender"],
                    "is_test": False,
                }
            )
        )

    return {
        "start_date": start_date.isoformat(),
        "end_date": end_date.isoformat(),
        "red_business_units": list(red_bus.keys()),
        "offenders_detected": len(staged),
        "staged": len(staged),
        "source_keys": [row["source_key"] for row in staged],
    }
