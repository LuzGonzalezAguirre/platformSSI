"""Manual COGP integration check staged directly in CCS."""
import hashlib
from datetime import datetime, timedelta
from decimal import Decimal
from zoneinfo import ZoneInfo

import pyodbc

from apps.quality.cogp.models import CogpSettings


TABLE = "dbo.ssi_ScrapOffenderActions"
CCS_SERVER = "AAS-PAC-FTP01"
CCS_DATABASE = "CCS"


def last_workweek(now=None):
    today = (now or datetime.now(ZoneInfo("America/Tijuana"))).date()
    monday = today - timedelta(days=today.weekday())
    if today.weekday() < 5:
        monday -= timedelta(days=7)
    return monday, monday + timedelta(days=4)


def _ccs_connection():
    installed = pyodbc.drivers()
    driver = next(
        (name for name in ("ODBC Driver 18 for SQL Server", "ODBC Driver 17 for SQL Server") if name in installed),
        None,
    )
    if not driver:
        raise RuntimeError("No se encontró ODBC Driver 18/17 for SQL Server.")
    connection_string = (
        f"DRIVER={{{driver}}};SERVER={CCS_SERVER};DATABASE={CCS_DATABASE};"
        "Trusted_Connection=yes;Encrypt=yes;TrustServerCertificate=yes;"
    )
    return pyodbc.connect(connection_string, timeout=15)


def _source_key(payload):
    required = ("week_start", "week_end", "business_unit", "workcenter", "part_no", "reason")
    identity = [str(payload[key]).strip().casefold() for key in required]
    if payload.get("is_test"):
        identity.append(str(payload.get("test_run_id") or ""))
    return hashlib.sha256("\x1f".join(identity).encode()).hexdigest()


def stage(payload):
    source_key = _source_key(payload)
    values = (
        source_key,
        payload["week_start"],
        payload["week_end"],
        payload["business_unit"],
        payload["workcenter"],
        payload["part_no"],
        payload.get("part_name", ""),
        payload["reason"],
        payload["scrap_cost"],
        payload["scrap_qty"],
        payload["total_scrap_cost"],
        payload["total_scrap_qty"],
        payload["production_cost"],
        payload["produced_qty"],
        payload["cost_rate_pct"],
        payload["pieces_rate_pct"],
        payload["cost_target_pct"],
        payload["pieces_target_pct"],
        int(payload["cost_offender"]),
        int(payload["pieces_offender"]),
        int(payload.get("is_test", False)),
    )
    with _ccs_connection() as connection:
        cursor = connection.cursor()
        cursor.execute(
            f"""
            IF NOT EXISTS (SELECT 1 FROM {TABLE} WITH (UPDLOCK, HOLDLOCK) WHERE SourceKey=?)
            INSERT INTO {TABLE} (
                SourceKey, WeekStart, WeekEnd, BusinessUnit, Workcenter,
                PartNo, PartName, ScrapReason, ScrapCost, ScrapQty,
                TotalScrapCost, TotalScrapQty, ProductionCost, ProducedQty,
                CostRatePct, PiecesRatePct, CostTargetPct, PiecesTargetPct,
                CostOffender, PiecesOffender, IsTest
            )
            VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
            """,
            (source_key, *values),
        )
        connection.commit()
    return {"source_key": source_key, "processing_status": "pending"}


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
