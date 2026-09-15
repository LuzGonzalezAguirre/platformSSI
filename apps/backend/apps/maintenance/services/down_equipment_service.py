import os
from collections import defaultdict
from datetime import date, datetime, timedelta

import requests
from django.core.cache import cache
from django.utils import timezone

from apps.maintenance.services.maintenance_classification import (
    UNCLASSIFIED,
    resolve_maintenance_bu,
)

PROXY_URL = os.getenv("PLEX_PROXY_URL", "http://host.docker.internal:8001")
PROXY_SECRET = os.getenv("PLEX_PROXY_SECRET", "")
HEADERS = {"Authorization": f"Bearer {PROXY_SECRET}"}
CURRENT_CACHE_TTL = 30
HISTORY_CACHE_TTL = 600


def _get(endpoint: str, timeout: int = 45) -> dict:
    response = requests.get(
        f"{PROXY_URL}{endpoint}", headers=HEADERS, timeout=timeout
    )
    response.raise_for_status()
    return response.json()


def _post(endpoint: str, payload: dict, timeout: int = 60) -> dict:
    response = requests.post(
        f"{PROXY_URL}{endpoint}", json=payload, headers=HEADERS, timeout=timeout
    )
    response.raise_for_status()
    return response.json()


def _parse_datetime(value) -> datetime | None:
    if not value:
        return None
    try:
        return datetime.fromisoformat(str(value).replace("Z", "+00:00"))
    except (TypeError, ValueError):
        return None


def _severity(minutes: int) -> str:
    if minutes >= 240:
        return "critical"
    if minutes >= 120:
        return "high"
    if minutes >= 60:
        return "warning"
    return "normal"


def _normalize_current(raw_rows: list[dict]) -> tuple[list[dict], str]:
    plex_now = next(
        (_parse_datetime(row.get("Plex_Now")) for row in raw_rows if row.get("Plex_Now")),
        None,
    )
    fallback_now = timezone.now().replace(tzinfo=None)
    now_value = plex_now or fallback_now

    rows = []
    for row in raw_rows:
        started = _parse_datetime(row.get("Started_At"))
        comparison_now = now_value
        if started and started.tzinfo and not comparison_now.tzinfo:
            comparison_now = comparison_now.replace(tzinfo=started.tzinfo)
        if started and comparison_now.tzinfo and not started.tzinfo:
            started = started.replace(tzinfo=comparison_now.tzinfo)
        elapsed = max(int((comparison_now - started).total_seconds() // 60), 0) if started else 0
        workcenter = str(row.get("Workcenter") or "").strip()
        workcenter_code = str(row.get("Workcenter_Code") or "").strip()

        rows.append({
            "equipment_id": workcenter_code or workcenter or "Unknown",
            "equipment_description": workcenter or workcenter_code or "Unknown",
            "workcenter": workcenter,
            "workcenter_group": str(row.get("Workcenter_Group") or "").strip(),
            "bu": resolve_maintenance_bu(row.get("Workcenter_Group"), workcenter),
            "status": str(row.get("Status") or "Down"),
            "reason": str(row.get("Reason") or "Sin razón"),
            "notes": str(row.get("Notes") or ""),
            "started_at": started.isoformat() if started else str(row.get("Started_At") or ""),
            "elapsed_minutes": elapsed,
            "logged_hours": float(row.get("Logged_Hours") or 0),
            "severity": _severity(elapsed),
        })

    rows.sort(key=lambda item: item["elapsed_minutes"], reverse=True)
    return rows, now_value.isoformat()


def _normalize_history(raw_rows: list[dict]) -> list[dict]:
    rows = []
    for row in raw_rows:
        started = _parse_datetime(row.get("Started_At"))
        workcenter = str(row.get("Workcenter") or "").strip()
        rows.append({
            "date": started.date().isoformat() if started else "",
            "equipment_id": str(row.get("Workcenter_Code") or workcenter or "Unknown"),
            "equipment_description": workcenter or str(row.get("Workcenter_Code") or "Unknown"),
            "workcenter": workcenter,
            "workcenter_group": str(row.get("Workcenter_Group") or "").strip(),
            "bu": resolve_maintenance_bu(row.get("Workcenter_Group"), workcenter),
            "reason": str(row.get("Reason") or "Sin razón"),
            "hours": float(row.get("Downtime_Hours") or 0),
        })
    return rows


def _filter_bu(rows: list[dict], allowed_bu: tuple[str, ...], include_unclassified: bool) -> list[dict]:
    allowed = set(allowed_bu)
    if include_unclassified:
        allowed.add(UNCLASSIFIED)
    return [row for row in rows if row["bu"] in allowed]


def _build_trends(rows: list[dict]) -> dict:
    by_day = defaultdict(lambda: {"hours": 0.0, "events": 0})
    by_bu = defaultdict(lambda: {"hours": 0.0, "events": 0})
    recurrent = defaultdict(lambda: {"description": "", "hours": 0.0, "events": 0})

    for row in rows:
        if row["date"]:
            by_day[row["date"]]["hours"] += row["hours"]
            by_day[row["date"]]["events"] += 1
        by_bu[row["bu"]]["hours"] += row["hours"]
        by_bu[row["bu"]]["events"] += 1
        item = recurrent[row["equipment_id"]]
        item["description"] = row["equipment_description"]
        item["hours"] += row["hours"]
        item["events"] += 1

    return {
        "by_day": [
            {"date": key, "hours": round(value["hours"], 2), "events": value["events"]}
            for key, value in sorted(by_day.items())
        ],
        "by_bu": sorted(
            [
                {"bu": key, "hours": round(value["hours"], 2), "events": value["events"]}
                for key, value in by_bu.items()
            ],
            key=lambda item: item["hours"],
            reverse=True,
        ),
        "recurrent": sorted(
            [
                {
                    "equipment_id": key,
                    "description": value["description"],
                    "hours": round(value["hours"], 2),
                    "events": value["events"],
                }
                for key, value in recurrent.items()
            ],
            key=lambda item: (item["events"], item["hours"]),
            reverse=True,
        )[:8],
    }


class DownEquipmentService:
    @staticmethod
    def get_dashboard(
        days: int,
        allowed_bu: tuple[str, ...],
        include_unclassified: bool = True,
    ) -> dict:
        current_raw = cache.get("maint:down-equipment:current:v1")
        if current_raw is None:
            current_raw = _get("/maintenance-current-down")
            cache.set("maint:down-equipment:current:v1", current_raw, CURRENT_CACHE_TTL)

        end_date = date.today()
        start_date = end_date - timedelta(days=days - 1)
        history_key = f"maint:down-equipment:history:v1:{start_date}:{end_date}"
        history_raw = cache.get(history_key)
        if history_raw is None:
            history_raw = _post("/maintenance-down-history", {
                "start_date": start_date.isoformat(),
                "end_date": end_date.isoformat(),
            })
            cache.set(history_key, history_raw, HISTORY_CACHE_TTL)

        current, as_of = _normalize_current(current_raw.get("data") or [])
        history = _normalize_history(history_raw.get("data") or [])
        current = _filter_bu(current, allowed_bu, include_unclassified)
        history = _filter_bu(history, allowed_bu, include_unclassified)

        bu_counts = defaultdict(int)
        for row in current:
            bu_counts[row["bu"]] += 1
        affected_bu = max(bu_counts, key=bu_counts.get) if bu_counts else None
        longest = current[0] if current else None

        return {
            "as_of": as_of,
            "range_days": days,
            "rows": current,
            "kpis": {
                "currently_down": len(current),
                "critical": sum(1 for row in current if row["elapsed_minutes"] >= 120),
                "longest_minutes": longest["elapsed_minutes"] if longest else 0,
                "longest_equipment": longest["equipment_id"] if longest else None,
                "most_affected_bu": affected_bu,
            },
            "trends": _build_trends(history),
        }
