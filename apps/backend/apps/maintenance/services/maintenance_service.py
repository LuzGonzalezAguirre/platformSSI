import os
import requests
from django.core.cache import cache

PROXY_URL    = os.getenv("PLEX_PROXY_URL", "http://host.docker.internal:8001")
PROXY_SECRET = os.getenv("PLEX_PROXY_SECRET", "")
HEADERS      = {"Authorization": f"Bearer {PROXY_SECRET}"}
CACHE_TTL    = 600


def _post(endpoint: str, payload: dict, timeout: int = 45) -> dict:
    resp = requests.post(
        f"{PROXY_URL}{endpoint}",
        json=payload,
        headers=HEADERS,
        timeout=timeout,
    )
    resp.raise_for_status()
    return resp.json()


class MaintenanceService:

    @staticmethod
    def get_kpis(start_date: str, end_date: str) -> dict:
        key    = f"maint:kpis:{start_date}:{end_date}"
        cached = cache.get(key)
        if cached:
            return cached
        result = _post("/maintenance-kpis", {"start_date": start_date, "end_date": end_date})
        cache.set(key, result, CACHE_TTL)
        return result

    @staticmethod
    def get_downtime_reasons(start_date: str, end_date: str) -> dict:
        key    = f"maint:reasons:{start_date}:{end_date}"
        cached = cache.get(key)
        if cached:
            return cached
        result = _post("/maintenance-downtime-reasons", {"start_date": start_date, "end_date": end_date})
        cache.set(key, result, CACHE_TTL)
        return result

    @staticmethod
    def get_downtime_detail(start_date: str, end_date: str, reason: str) -> dict:
        # Detail no se cachea agresivamente — es drill-down bajo demanda
        key    = f"maint:detail:{start_date}:{end_date}:{reason}"
        cached = cache.get(key)
        if cached:
            return cached
        result = _post("/maintenance-downtime-detail", {
            "start_date": start_date,
            "end_date":   end_date,
            "reason":     reason,
        })
        cache.set(key, result, 300)  # 5 min para detail
        return result
    
    @staticmethod
    def get_downtime_by_month(start_date: str, end_date: str) -> dict:
        key    = f"maint:by_month:{start_date}:{end_date}"
        cached = cache.get(key)
        if cached:
            return cached
        result = _post("/maintenance-downtime-by-month", {
            "start_date": start_date,
            "end_date":   end_date,
        })
        cache.set(key, result, CACHE_TTL)
        return result
    
    @staticmethod
    def get_oee_live(start_date: str, end_date: str) -> dict | None:
        key    = f"maint:oee_live:{start_date}:{end_date}"
        cached = cache.get(key)
        if cached:
            return cached
        result = _post("/oee-live", {"start_date": start_date, "end_date": end_date}, timeout=60)
        data   = result.get("data")
        if data:
            cache.set(key, data, CACHE_TTL)
        return data

    @staticmethod
    def get_oee_trend_live(start_date: str, end_date: str) -> list:
        from datetime import date, timedelta

        key    = f"maint:oee_trend_live:{start_date}:{end_date}"
        cached = cache.get(key)
        if cached:
            return cached

        start = date.fromisoformat(start_date)
        end   = date.fromisoformat(end_date)
        days  = (end - start).days + 1

        if days > 365:
            start = end - timedelta(days=364)
    
        result  = []
        current = start
        while current <= end:
            date_str = current.strftime("%Y-%m-%d")
            try:
                resp = _post("/oee-live", {"start_date": date_str, "end_date": date_str}, timeout=60)
                data = resp.get("data")
                if data and data.get("oee_pct", 0) > 0:
                    result.append({
                        "date":             date_str,
                        "oee_pct":          round(data["oee_pct"], 2),
                        "availability_pct": round(data["availability_pct"], 2),
                        "performance_pct":  round(data["performance_pct"], 2),
                        "quality_pct":      round(data["quality_pct"], 2),
                    })
            except Exception:
                pass
            current += timedelta(days=1)
    
        cache.set(key, result, 3600)
        return result