import os
from collections import defaultdict
from datetime import date, timedelta

import requests
from django.core.cache import cache
from apps.ssi_common.filters.base import FilterContext

PROXY_URL    = os.getenv("PLEX_PROXY_URL", "http://host.docker.internal:8001")
PROXY_SECRET = os.getenv("PLEX_PROXY_SECRET", "")
HEADERS      = {"Authorization": f"Bearer {PROXY_SECRET}"}
CACHE_TTL    = 600
PLEX_CHUNK_DAYS = 168


def _post(endpoint: str, payload: dict, timeout: int = 45) -> dict:
    resp = requests.post(
        f"{PROXY_URL}{endpoint}",
        json=payload,
        headers=HEADERS,
        timeout=timeout,
    )
    resp.raise_for_status()
    return resp.json()


def _date_chunks(start_date: str, end_date: str, chunk_days: int = PLEX_CHUNK_DAYS):
    """Yield inclusive date windows small enough for the Plex ODBC driver."""
    start = date.fromisoformat(start_date)
    end = date.fromisoformat(end_date)
    if end < start:
        raise ValueError("end_date anterior a start_date")

    current = start
    while current <= end:
        chunk_end = min(current + timedelta(days=chunk_days - 1), end)
        yield current.isoformat(), chunk_end.isoformat()
        current = chunk_end + timedelta(days=1)


def _round2(value: float) -> float:
    return round(value, 2)


def _oee_periods(start_date: str, end_date: str):
    """Keep short trends daily and annual trends monthly.

    Calling /oee-live once per day made a 365-day Overview issue 365 proxy
    requests. Monthly buckets preserve a useful annual trend with at most 13
    requests (two partial months plus the complete months in between).
    """
    start = date.fromisoformat(start_date)
    end = date.fromisoformat(end_date)
    days = (end - start).days + 1

    if days <= 120:
        current = start
        while current <= end:
            yield current, current
            current += timedelta(days=1)
        return

    current = start
    while current <= end:
        if current.month == 12:
            next_month = date(current.year + 1, 1, 1)
        else:
            next_month = date(current.year, current.month + 1, 1)
        period_end = min(next_month - timedelta(days=1), end)
        yield current, period_end
        current = period_end + timedelta(days=1)


class MaintenanceService:

    @staticmethod
    def get_kpis(filter_ctx: FilterContext) -> dict:
        cache_key = filter_ctx.cache_key("maint:kpis:v2")
        cached = cache.get(cache_key)
        if cached:
            return cached

        chunks = list(_date_chunks(
            filter_ctx.start_date.isoformat(), filter_ctx.end_date.isoformat()
        ))
        if len(chunks) == 1:
            result = _post("/maintenance-kpis", {
                "start_date": chunks[0][0],
                "end_date": chunks[0][1],
            })
            cache.set(cache_key, result, CACHE_TTL)
            return result

        totals = defaultdict(float)
        fields = (
            "operating_hours", "downtime_hours", "down_hours",
            "setup_hours", "idle_hours", "total_failures",
        )
        for chunk_start, chunk_end in chunks:
            response = _post("/maintenance-kpis", {
                "start_date": chunk_start,
                "end_date": chunk_end,
            })
            data = response.get("data") or {}
            for field in fields:
                totals[field] += float(data.get(field) or 0)

        failures = totals["total_failures"]
        operating = totals["operating_hours"]
        downtime = totals["downtime_hours"]
        failure_hours = max(downtime - totals["setup_hours"], 0)
        planned = operating + downtime
        data = {field: _round2(totals[field]) for field in fields}
        data["total_failures"] = int(failures)
        data["mttr_hours"] = _round2(failure_hours / failures) if failures else None
        data["mtbf_hours"] = _round2(operating / failures) if failures else None
        data["availability_pct"] = _round2(operating * 100 / planned) if planned else None
        result = {"data": data}
        cache.set(cache_key, result, CACHE_TTL)
        return result

    @staticmethod
    def get_downtime_reasons(start_date: str, end_date: str) -> dict:
        key    = f"maint:reasons:{start_date}:{end_date}"
        cached = cache.get(key)
        if cached:
            return cached
        chunks = list(_date_chunks(start_date, end_date))
        if len(chunks) == 1:
            result = _post("/maintenance-downtime-reasons", {
                "start_date": chunks[0][0],
                "end_date": chunks[0][1],
            })
            cache.set(key, result, CACHE_TTL)
            return result

        by_reason = defaultdict(lambda: {"total_events": 0, "total_hours": 0.0})
        for chunk_start, chunk_end in chunks:
            response = _post("/maintenance-downtime-reasons", {
                "start_date": chunk_start,
                "end_date": chunk_end,
            })
            for row in response.get("data", []):
                item = by_reason[row["reason"]]
                item["total_events"] += int(row.get("total_events") or 0)
                item["total_hours"] += float(row.get("total_hours") or 0)

        grand_total = sum(item["total_hours"] for item in by_reason.values())
        data = [
            {
                "reason": reason,
                "total_events": item["total_events"],
                "total_hours": _round2(item["total_hours"]),
                "percentage": _round2(item["total_hours"] * 100 / grand_total) if grand_total else 0,
            }
            for reason, item in by_reason.items()
        ]
        data.sort(key=lambda row: row["total_hours"], reverse=True)
        result = {"data": data, "grand_total_hours": _round2(grand_total)}
        cache.set(key, result, CACHE_TTL)
        return result

    @staticmethod
    def get_downtime_detail(start_date: str, end_date: str, reason: str) -> dict:
        key    = f"maint:detail:{start_date}:{end_date}:{reason}"
        cached = cache.get(key)
        if cached:
            return cached
        result = _post("/maintenance-downtime-detail", {
            "start_date": start_date,
            "end_date":   end_date,
            "reason":     reason,
        })
        cache.set(key, result, 300)
        return result
    
    @staticmethod
    def get_downtime_by_month(start_date: str, end_date: str) -> dict:
        key    = f"maint:by_month:{start_date}:{end_date}"
        cached = cache.get(key)
        if cached:
            return cached
        chunks = list(_date_chunks(start_date, end_date))
        if len(chunks) == 1:
            result = _post("/maintenance-downtime-by-month", {
                "start_date": chunks[0][0],
                "end_date": chunks[0][1],
            })
            cache.set(key, result, CACHE_TTL)
            return result

        data = []
        for chunk_start, chunk_end in chunks:
            response = _post("/maintenance-downtime-by-month", {
                "start_date": chunk_start,
                "end_date": chunk_end,
            })
            data.extend(response.get("data", []))
        data.sort(key=lambda row: (row.get("date", ""), row.get("reason", "")))
        result = {"data": data}
        cache.set(key, result, CACHE_TTL)
        return result
    
    @staticmethod
    def get_oee_live(start_date: str, end_date: str) -> dict | None:
        key    = f"maint:oee_live:{start_date}:{end_date}"
        cached = cache.get(key)
        if cached:
            return cached
        chunks = list(_date_chunks(start_date, end_date))
        totals = defaultdict(float)
        found = False
        required_raw = ("operating_hours", "plan_hours", "ideal_hours_total")

        for chunk_start, chunk_end in chunks:
            result = _post(
                "/oee-live",
                {"start_date": chunk_start, "end_date": chunk_end},
                timeout=60,
            )
            raw = result.get("data")
            item = raw.get("total") if raw else None
            if not item:
                continue
            if len(chunks) == 1:
                cache.set(key, item, CACHE_TTL)
                return item
            if len(chunks) > 1 and any(field not in item for field in required_raw):
                raise RuntimeError(
                    "plex-proxyO debe actualizarse antes de consultar OEE en rangos mayores a 168 dias"
                )
            found = True
            for field in (
                "good_qty", "scrap_qty", "total_qty",
                "operating_hours", "plan_hours", "ideal_hours_total",
            ):
                totals[field] += float(item.get(field) or 0)

        if not found:
            return None

        availability = totals["operating_hours"] * 100 / totals["plan_hours"] if totals["plan_hours"] else 0
        performance = totals["ideal_hours_total"] * 100 / totals["operating_hours"] if totals["operating_hours"] else 0
        quality = totals["good_qty"] * 100 / totals["total_qty"] if totals["total_qty"] else 0
        oee = min((availability / 100) * (performance / 100) * (quality / 100) * 100, 100)
        data = {
            "part_workcenter": "TOTAL",
            "good_qty": totals["good_qty"],
            "scrap_qty": totals["scrap_qty"],
            "total_qty": totals["total_qty"],
            "availability_pct": _round2(availability),
            "performance_pct": _round2(performance),
            "quality_pct": _round2(quality),
            "oee_pct": _round2(oee),
        }
        if data:
            cache.set(key, data, CACHE_TTL)
        return data

    @staticmethod
    def get_oee_trend_live(start_date: str, end_date: str) -> list:
        key    = f"maint:oee_trend_live:{start_date}:{end_date}"
        cached = cache.get(key)
        if cached:
            return cached

        result  = []
        for period_start, period_end in _oee_periods(start_date, end_date):
            try:
                resp = _post("/oee-live", {
                    "start_date": period_start.isoformat(),
                    "end_date": period_end.isoformat(),
                }, timeout=60)
                raw  = resp.get("data")
                data = raw.get("total") if raw else None
                if data and data.get("oee_pct", 0) > 0:
                    result.append({
                        "date":             period_end.isoformat(),
                        "oee_pct":          round(data["oee_pct"], 2),
                        "availability_pct": round(data["availability_pct"], 2),
                        "performance_pct":  round(data["performance_pct"], 2),
                        "quality_pct":      round(data["quality_pct"], 2),
                    })
            except Exception:
                pass
    
        cache.set(key, result, 3600)
        return result
