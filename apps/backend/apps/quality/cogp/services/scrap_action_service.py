"""Manual COGP integration check through ActionTracker's CCS outbox."""
from datetime import datetime, timedelta
from decimal import Decimal
from zoneinfo import ZoneInfo

import httpx
from django.conf import settings

from apps.quality.cogp.models import CogpSettings


def last_workweek(now=None):
    today = (now or datetime.now(ZoneInfo("America/Tijuana"))).date()
    monday = today - timedelta(days=today.weekday())
    if today.weekday() < 5:
        monday -= timedelta(days=7)
    return monday, monday + timedelta(days=4)


def deliver(payload):
    url = getattr(settings, "ACTION_TRACKER_URL", "").rstrip("/")
    user = getattr(settings, "ACTION_TRACKER_BOT_USER", "")
    password = getattr(settings, "ACTION_TRACKER_BOT_PASSWORD", "")
    if not url or not user or not password:
        raise RuntimeError("Falta configuración de ActionTracker y Bot.")
    response = httpx.post(f"{url}/api/scrap-offenders", json=payload,
                          auth=(user, password), timeout=45)
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
    piece_rate = Decimal(scrap_qty) / Decimal(scrap_qty + produced_qty) * 100 if scrap_qty + produced_qty else Decimal("0")
    cost_offender = production_cost > 0 and cost_rate > cfg.cost_target_pct
    pieces_offender = scrap_qty + produced_qty > 0 and piece_rate > cfg.pieces_target_pct
    if not cost_offender and not pieces_offender:
        raise ValueError("La prueba debe rebasar al menos una meta.")
    return deliver({
        "week_start": start.isoformat(), "week_end": end.isoformat(),
        "business_unit": data["business_unit"], "workcenter": data["workcenter"],
        "part_no": data["part_no"], "part_name": data.get("part_name", ""),
        "reason": data["reason"], "scrap_cost": str(cost), "scrap_qty": scrap_qty,
        "total_scrap_cost": str(cost), "total_scrap_qty": scrap_qty,
        "production_cost": str(production_cost), "produced_qty": produced_qty,
        "cost_rate_pct": str(cost_rate), "pieces_rate_pct": str(piece_rate),
        "cost_target_pct": str(cfg.cost_target_pct), "pieces_target_pct": str(cfg.pieces_target_pct),
        "cost_offender": cost_offender, "pieces_offender": pieces_offender,
        "is_test": True, "test_run_id": str(data["test_run_id"]),
    })
