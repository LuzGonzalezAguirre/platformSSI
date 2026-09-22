"""Weekly Maintenance offender staging through qwall-proxy."""
import hashlib
import logging
from datetime import date, timedelta
from decimal import Decimal

import requests
from django.conf import settings

from apps.maintenance.services.work_requests_service import WorkRequestsService
from apps.ssi_common.filters.base import FilterContext

logger = logging.getLogger(__name__)


def last_completed_workweek(reference_date: date) -> tuple[date, date]:
    monday = reference_date - timedelta(days=reference_date.weekday())
    if reference_date.weekday() < 5:
        monday -= timedelta(days=7)
    return monday, monday + timedelta(days=4)


def _source_key(payload: dict) -> str:
    identity = [
        str(payload["week_start"]).strip().casefold(),
        str(payload["week_end"]).strip().casefold(),
        str(payload["equipment_id"]).strip().casefold(),
    ]
    return hashlib.sha256("\x1f".join(identity).encode()).hexdigest()


def _stage(payload: dict) -> dict:
    proxy_url = settings.QWALL_PROXY_URL.rstrip("/")
    token = settings.QWALL_PROXY_TOKEN
    if not token:
        raise RuntimeError("QWALL_PROXY_TOKEN no está configurado.")

    source_key = _source_key(payload)
    response = requests.post(
        f"{proxy_url}/maintenance-offenders/stage",
        json={**payload, "source_key": source_key},
        headers={"Authorization": f"Bearer {token}"},
        timeout=30,
    )
    response.raise_for_status()
    return response.json()


def stage_weekly_maintenance_offenders(reference_date: date) -> dict:
    week_start, week_end = last_completed_workweek(reference_date)
    dashboard = WorkRequestsService.get_dashboard(
        FilterContext(start_date=week_start, end_date=week_end)
    )
    rows = dashboard.get("rows") or []

    equipment: dict[str, dict] = {}
    for row in rows:
        equipment_id = str(row.get("equipment_id") or "").strip()
        if not equipment_id:
            continue
        item = equipment.setdefault(
            equipment_id,
            {
                "equipment_id": equipment_id,
                "equipment_description": str(row.get("equipment_description") or "").strip(),
                "physical_area": str(row.get("workcenter") or "").strip() or "SIN_AREA",
                "department": str(row.get("department") or "").strip(),
                "maintenance_hours": Decimal("0"),
                "work_request_count": 0,
            },
        )
        item["maintenance_hours"] += Decimal(str(row.get("maintenance_hours") or 0))
        item["work_request_count"] += 1

    top3 = sorted(
        equipment.values(),
        key=lambda item: item["maintenance_hours"],
        reverse=True,
    )[:3]

    staged = []
    for rank, item in enumerate(top3, start=1):
        if item["maintenance_hours"] <= 0:
            continue
        staged.append(
            _stage(
                {
                    "week_start": week_start.isoformat(),
                    "week_end": week_end.isoformat(),
                    "equipment_id": item["equipment_id"],
                    "equipment_description": item["equipment_description"],
                    "physical_area": item["physical_area"],
                    "department": item["department"],
                    "maintenance_hours": str(item["maintenance_hours"]),
                    "work_request_count": item["work_request_count"],
                    "rank_no": rank,
                }
            )
        )

    return {
        "start_date": week_start.isoformat(),
        "end_date": week_end.isoformat(),
        "top_count": len(staged),
        "equipment": [
            {
                "equipment_id": item["equipment_id"],
                "maintenance_hours": str(item["maintenance_hours"]),
                "rank_no": rank,
            }
            for rank, item in enumerate(top3, start=1)
            if item["maintenance_hours"] > 0
        ],
        "source_keys": [row["source_key"] for row in staged],
    }
