import os
import requests
from django.core.cache import cache

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


class WorkRequestsService:

    @staticmethod
    def get_dashboard(start_date: str, end_date: str) -> dict:
        cache_key = f"maint:wr_dashboard:{start_date}:{end_date}"
        cached    = cache.get(cache_key)
        if cached:
            return cached

        raw = _post("/work-requests", {"start_date": start_date, "end_date": end_date})
        rows = raw.get("data", [])

        if not rows:
            return {"rows": [], "kpis": {}, "by_status": [], "by_type": [],
                    "by_equipment": [], "by_technician": [], "by_failure": [],
                    "by_day": [], "by_department": []}

        # ── KPIs ──────────────────────────────────────────────────────────────
        total_wr      = len(rows)
        total_hours   = sum(r["maintenance_hours"] for r in rows)
        completed     = [r for r in rows if "complet" in r["status"].lower()]
        pending       = [r for r in rows if "complet" not in r["status"].lower()]
        completed_pct = round(len(completed) / total_wr * 100, 1) if total_wr else 0
        avg_hours     = round(total_hours / total_wr, 2) if total_wr else 0

        # Lead time: request_date → completed_date (días)
        lead_times = []
        for r in completed:
            if r["completed_date"] and r["request_date"]:
                from datetime import date
                try:
                    req  = date.fromisoformat(r["request_date"][:10])
                    comp = date.fromisoformat(r["completed_date"][:10])
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

        # Backlog: pending con due_date vencida
        from datetime import date as date_type
        today = date_type.today()
        backlog = sum(
            1 for r in pending
            if r["due_date"] and date_type.fromisoformat(r["due_date"][:10]) < today
        )

        kpis = {
            "total_wr":       total_wr,
            "total_hours":    round(total_hours, 2),
            "completed_pct":  completed_pct,
            "pending_count":  len(pending),
            "avg_hours":      avg_hours,
            "top_failure":    top_failure,
            "avg_lead_time":  avg_lead_time,
            "backlog":        backlog,
        }

        # ── Agrupaciones ──────────────────────────────────────────────────────
        def group_by(field: str, value_fn=None) -> list:
            acc: dict = {}
            for r in rows:
                key = r.get(field) or "Unknown"
                if key not in acc:
                    acc[key] = {"label": key, "count": 0, "hours": 0.0}
                acc[key]["count"] += 1
                acc[key]["hours"] += r["maintenance_hours"]
            return sorted(acc.values(), key=lambda x: x["hours"], reverse=True)

        by_status     = group_by("status")
        by_type       = group_by("type")
        by_equipment  = _top(group_by("equipment_id"), "hours")
        by_technician = _top(group_by("assigned_to"), "hours")
        by_failure    = _top(group_by("failure"), "count")
        by_department = group_by("department")

        # By day
        day_acc: dict = {}
        for r in rows:
            day = r["request_date"][:10]
            if day not in day_acc:
                day_acc[day] = {"date": day, "count": 0, "hours": 0.0}
            day_acc[day]["count"] += 1
            day_acc[day]["hours"] += r["maintenance_hours"]
        by_day = sorted(day_acc.values(), key=lambda x: x["date"])

        # Equipment grid (para bubble chart)
        eq_acc: dict = {}
        for r in rows:
            eid = r["equipment_id"] or "Unknown"
            if eid not in eq_acc:
                eq_acc[eid] = {
                    "equipment_id":  eid,
                    "description":   r["equipment_description"],
                    "group":         r["equipment_group"],
                    "department":    r["department"],
                    "count":         0,
                    "hours":         0.0,
                    "statuses":      {},
                }
            eq_acc[eid]["count"] += 1
            eq_acc[eid]["hours"] += r["maintenance_hours"]
            st = r["status"]
            eq_acc[eid]["statuses"][st] = eq_acc[eid]["statuses"].get(st, 0) + 1

        # Status dominante por equipo
        equipment_grid = []
        for eq in eq_acc.values():
            dominant = max(eq["statuses"], key=eq["statuses"].get) if eq["statuses"] else "Unknown"
            equipment_grid.append({**eq, "dominant_status": dominant, "statuses": eq["statuses"]})

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
        return result