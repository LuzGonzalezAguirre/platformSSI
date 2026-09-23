import os
import requests
from datetime import date as date_type
from django.core.cache import cache
from apps.ssi_common.filters.base import FilterContext
from apps.ssi_common.plex_ranges import date_chunks
from apps.ssi_common.bu_classification import (
    resolve_bu_from_workcenter,
    resolve_customer_from_workcenter,
    CUSTOMER_JOHN_DEERE,
)
from apps.ssi_common.action_tracker_actions import get_open_actions, dedupe_actions

PROXY_URL    = os.getenv("PLEX_PROXY_URL", "http://host.docker.internal:8001")
PROXY_SECRET = os.getenv("PLEX_PROXY_SECRET", "")
HEADERS      = {"Authorization": f"Bearer {PROXY_SECRET}"}
CACHE_TTL    = 300


def _post(endpoint: str, payload: dict, timeout: int = 60) -> dict:
    resp = requests.post(
        f"{PROXY_URL}{endpoint}",
        json=payload,
        headers=HEADERS,
        timeout=timeout,
    )
    resp.raise_for_status()
    return resp.json()


def _top(items: list, key: str, n: int = 10) -> list:
    return sorted(items, key=lambda x: x[key], reverse=True)[:n]


def _matches_bu(row: dict, bu_code: str) -> bool:
    """
    JOHN_DEERE no es una BU real en bu_classification.py (es el cliente
    del grupo 'Speed'), así que se resuelve vía resolve_customer_from_workcenter.
    El resto de las BUs (VOLVO, CUMMINS, TULC) usan el criterio real de BU.
    """
    if bu_code == "JOHN_DEERE":
        return resolve_customer_from_workcenter(
            row.get("workcenter_group"), row.get("workcenter")
        ) == CUSTOMER_JOHN_DEERE
    return resolve_bu_from_workcenter(row.get("workcenter_group"), row.get("workcenter")) == bu_code


def _apply_filters(rows: list, filter_ctx: FilterContext) -> list:
    if filter_ctx.workcenter:
        rows = [r for r in rows if r.get("workcenter") in filter_ctx.workcenter]

    if filter_ctx.bu:
        rows = [r for r in rows if any(_matches_bu(r, bu_code) for bu_code in filter_ctx.bu)]

    return rows


class WorkRequestsService:

    @staticmethod
    def _with_action_refs(result: dict, filter_ctx: FilterContext) -> dict:
        """Attach live open ActionTracker links without storing them in the 5-minute Plex cache."""
        open_actions = get_open_actions("maintenance")
        equipment_ids = {
            str(row.get("equipment_id") or "").strip().casefold()
            for row in result.get("rows", [])
            if str(row.get("equipment_id") or "").strip()
        }

        start_iso = filter_ctx.start_date.isoformat()
        end_iso = filter_ctx.end_date.isoformat()
        relevant = []
        for action in open_actions:
            equipment_key = str(action.get("equipment_id") or "").strip().casefold()
            first_week = str(action.get("first_week_start") or "")
            last_week = str(action.get("last_week_end") or "")
            overlaps_range = bool(
                first_week and last_week
                and first_week <= end_iso
                and last_week >= start_iso
            )
            if equipment_key in equipment_ids or overlaps_range:
                relevant.append(action)
        relevant = dedupe_actions(relevant)

        by_equipment = []
        for item in result.get("by_equipment", []):
            equipment_key = str(item.get("label") or "").strip().casefold()
            item_actions = dedupe_actions([
                action for action in open_actions
                if str(action.get("equipment_id") or "").strip().casefold() == equipment_key
            ])
            by_equipment.append({**item, "actions": item_actions})

        return {
            **result,
            "by_equipment": by_equipment,
            "actions": relevant,
        }

    @staticmethod
    def get_dashboard(filter_ctx: FilterContext) -> dict:
        cache_key = filter_ctx.cache_key("maint:wr_dashboard:v2")
        cached = cache.get(cache_key)
        if cached:
            return WorkRequestsService._with_action_refs(cached, filter_ctx)

        by_number: dict = {}
        for chunk_start, chunk_end in date_chunks(filter_ctx.start_date, filter_ctx.end_date):
            raw = _post("/work-requests", {
                "start_date": chunk_start.isoformat(),
                "end_date": chunk_end.isoformat(),
            })
            for row in raw.get("data", []):
                by_number[row.get("work_request_no")] = row
        rows = list(by_number.values())
        rows = _apply_filters(rows, filter_ctx)

        if not rows:
            result = {
                "rows": [], "kpis": {}, "by_status": [], "by_type": [],
                "by_equipment": [], "by_technician": [], "by_failure": [],
                "by_day": [], "by_department": [], "equipment_grid": [],
            }
            cache.set(cache_key, result, CACHE_TTL)
            return WorkRequestsService._with_action_refs(result, filter_ctx)

        # ── KPIs ──────────────────────────────────────────────────────────────
        total_wr          = len(rows)
        total_scheduled   = sum(r["scheduled_hours"]   for r in rows)
        total_maintenance = sum(r["maintenance_hours"] for r in rows)
        completed         = [r for r in rows if "complet" in r["status"].lower()]
        pending           = [r for r in rows if "complet" not in r["status"].lower()]
        completed_pct     = round(len(completed) / total_wr * 100, 1) if total_wr else 0
        avg_scheduled     = round(total_scheduled   / total_wr, 2) if total_wr else 0
        avg_maintenance   = round(total_maintenance / total_wr, 2) if total_wr else 0

        # Eficiencia: real vs planeado (solo WR con ambos valores)
        efficiency_rows = [r for r in completed if r["scheduled_hours"] > 0 and r["maintenance_hours"] > 0]
        efficiency      = round(
            sum(r["scheduled_hours"] / r["maintenance_hours"] for r in efficiency_rows) / len(efficiency_rows) * 100, 1
        ) if efficiency_rows else None

        # Lead time
        lead_times = []
        for r in completed:
            if r["completed_date"] and r["request_date"]:
                try:
                    req  = date_type.fromisoformat(r["request_date"][:10])
                    comp = date_type.fromisoformat(r["completed_date"][:10])
                    lead_times.append((comp - req).days)
                except Exception:
                    pass
        avg_lead_time = round(sum(lead_times) / len(lead_times), 1) if lead_times else None

        # Top failure
        failure_counts: dict = {}
        for r in rows:
            if r["failure"]:
                failure_counts[r["failure"]] = failure_counts.get(r["failure"], 0) + 1
        top_failure = max(failure_counts, key=failure_counts.get) if failure_counts else "—"

        # Backlog
        today   = date_type.today()
        backlog = sum(
            1 for r in pending
            if r["due_date"] and date_type.fromisoformat(r["due_date"][:10]) < today
        )

        kpis = {
            "total_wr":          total_wr,
            "total_scheduled":   round(total_scheduled,   2),
            "total_maintenance": round(total_maintenance, 2),
            "completed_pct":     completed_pct,
            "pending_count":     len(pending),
            "avg_scheduled":     avg_scheduled,
            "avg_maintenance":   avg_maintenance,
            "efficiency":        efficiency,       # % planeado/real
            "top_failure":       top_failure,
            "avg_lead_time":     avg_lead_time,
            "backlog":           backlog,
        }

        # ── Agrupaciones — usan maintenance_hours (horas reales) ──────────────
        def group_by(field: str) -> list:
            acc: dict = {}
            for r in rows:
                key = r.get(field) or "Unknown"
                if key not in acc:
                    acc[key] = {"label": key, "count": 0, "scheduled_hours": 0.0, "hours": 0.0}
                acc[key]["count"]           += 1
                acc[key]["scheduled_hours"] += r["scheduled_hours"]
                acc[key]["hours"]           += r["maintenance_hours"]
            return sorted(acc.values(), key=lambda x: x["hours"], reverse=True)

        by_status     = group_by("status")
        by_type       = group_by("type")
        by_equipment  = _top(group_by("equipment_id"), "hours")
        by_technician = _top(group_by("assigned_to"),  "hours")
        by_failure    = _top(group_by("failure"),       "count")
        by_department = group_by("department")

        # By day — ambas horas
        day_acc: dict = {}
        for r in rows:
            day = r["request_date"][:10]
            if day not in day_acc:
                day_acc[day] = {"date": day, "count": 0, "scheduled_hours": 0.0, "hours": 0.0}
            day_acc[day]["count"]           += 1
            day_acc[day]["scheduled_hours"] += r["scheduled_hours"]
            day_acc[day]["hours"]           += r["maintenance_hours"]
        by_day = sorted(day_acc.values(), key=lambda x: x["date"])

        # Equipment grid
        eq_acc: dict = {}
        for r in rows:
            eid = r["equipment_id"] or "Unknown"
            if eid not in eq_acc:
                eq_acc[eid] = {
                    "equipment_id":    eid,
                    "description":     r["equipment_description"],
                    "group":           r["equipment_group"],
                    "department":      r["department"],
                    "count":           0,
                    "scheduled_hours": 0.0,
                    "hours":           0.0,
                    "statuses":        {},
                }
            eq_acc[eid]["count"]           += 1
            eq_acc[eid]["scheduled_hours"] += r["scheduled_hours"]
            eq_acc[eid]["hours"]           += r["maintenance_hours"]
            st = r["status"]
            eq_acc[eid]["statuses"][st] = eq_acc[eid]["statuses"].get(st, 0) + 1

        equipment_grid = []
        for eq in eq_acc.values():
            dominant = max(eq["statuses"], key=eq["statuses"].get) if eq["statuses"] else "Unknown"
            equipment_grid.append({**eq, "dominant_status": dominant})

        result = {
            "rows":           rows,
            "kpis":           kpis,
            "by_status":      by_status,
            "by_type":        by_type,
            "by_equipment":   by_equipment,
            "by_technician":  by_technician,
            "by_failure":     by_failure,
            "by_day":         by_day,
            "by_department":  by_department,
            "equipment_grid": equipment_grid,
        }

        cache.set(cache_key, result, CACHE_TTL)
        return WorkRequestsService._with_action_refs(result, filter_ctx)
