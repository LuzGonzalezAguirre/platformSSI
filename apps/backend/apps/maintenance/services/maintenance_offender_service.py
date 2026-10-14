"""Weekly Maintenance offender staging through qwall-proxy."""
import hashlib
import logging
from datetime import date, timedelta

import requests
from django.conf import settings

from apps.maintenance.services.work_requests_service import WorkRequestsService, aggregate_planned_equipment
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

    # Identical planned WR ranking to Maintenance Overview Pareto.
    # `rows` are already deduplicated and scoped by WorkRequestsService.
    top3 = aggregate_planned_equipment(rows)[:3]

    staged = []
    for rank, item in enumerate(top3, start=1):
        if item["hours"] <= 0:
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
                    "maintenance_hours": str(item["hours"]),
                    "work_request_count": item["count"],
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
                "maintenance_hours": str(item["hours"]),
                "rank_no": rank,
            }
            for rank, item in enumerate(top3, start=1)
            if item["hours"] > 0
        ],
        "source_keys": [row["source_key"] for row in staged],
    }
