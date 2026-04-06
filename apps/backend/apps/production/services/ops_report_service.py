import os
import requests
from django.core.cache import cache
from datetime import date

PROXY_URL    = os.getenv("PLEX_PROXY_URL", "http://host.docker.internal:8001")
PROXY_SECRET = os.getenv("PLEX_PROXY_SECRET", "")
HEADERS      = {"Authorization": f"Bearer {PROXY_SECRET}"}
CACHE_TTL    = 600
DAY_MAP = ["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"]


def _post(endpoint: str, payload: dict, timeout: int = 30) -> dict:
    resp = requests.post(
        f"{PROXY_URL}{endpoint}",
        json=payload,
        headers=HEADERS,
        timeout=timeout,
    )
    resp.raise_for_status()
    return resp.json()


def _get_day_target(report_date: date, bu_code: str) -> int:
    from apps.production.repositories.targets_repository import TargetsRepository
    obj = TargetsRepository.get_weekly_target(report_date, bu_code)
    if not obj:
        return 0
    day_name = DAY_MAP[report_date.weekday()]
    return obj.get_day_target(day_name)


def _get_wip(report_date: date, bu_code: str) -> dict:
    from apps.production.repositories.targets_repository import TargetsRepository
    obj = TargetsRepository.get_weekly_wip(report_date, bu_code)
    if not obj:
        return {"actual": 0, "goal": 0}
    day_name = DAY_MAP[report_date.weekday()]
    return {
        "actual": obj.get_day_value(day_name, "actual"),
        "goal":   obj.get_day_value(day_name, "goal"),
    }


class OpsReportService:

    @staticmethod
    def get_daily_production(report_date: date) -> dict:
        key    = f"ops:daily_production:{report_date}"
        cached = cache.get(key)
        if cached:
            return cached
        data = _post("/daily-production", {"report_date": str(report_date)})
        cache.set(key, data, CACHE_TTL)
        return data

    @staticmethod
    def get_scrap_cogp(report_date: date) -> dict:
        key    = f"ops:scrap_cogp:{report_date}"
        cached = cache.get(key)
        if cached:
            return cached
        data = _post("/scrap-cogp", {"report_date": str(report_date)})
        cache.set(key, data, CACHE_TTL)
        return data

    @staticmethod
    def get_earned_labor_hours(report_date: date) -> dict:
        key    = f"ops:earned_hours:{report_date}"
        cached = cache.get(key)
        if cached:
            return cached
        data = _post("/earned-labor-hours", {"report_date": str(report_date)})
        cache.set(key, data, CACHE_TTL)
        return data

    @staticmethod
    def get_yield_by_client(report_date: date) -> dict:
        key    = f"ops:yield:{report_date}"
        cached = cache.get(key)
        if cached:
            return cached
        data = _post("/yield-by-client", {"report_date": str(report_date)})
        cache.set(key, data, CACHE_TTL)
        return data

    @staticmethod
    def get_daily_summary(report_date: date) -> dict:
        prod   = OpsReportService.get_daily_production(report_date)
        scrap  = OpsReportService.get_scrap_cogp(report_date)
        yield_ = OpsReportService.get_yield_by_client(report_date)
        hours  = OpsReportService.get_earned_labor_hours(report_date)
    
        def cogp_pct(scrap_cost: float, cogp_cost: float) -> float:
            return round((scrap_cost / cogp_cost * 100), 2) if cogp_cost > 0 else 0.0

        def production_pct(produced: int, target: int) -> float:
            return round((produced / target * 100), 1) if target > 0 else 0.0

        volvo_target   = _get_day_target(report_date, "volvo")
        cummins_target = _get_day_target(report_date, "cummins")
        tulc_target    = _get_day_target(report_date, "tulc")

        volvo_wip   = _get_wip(report_date, "volvo")
        cummins_wip = _get_wip(report_date, "cummins")
        tulc_wip    = _get_wip(report_date, "tulc")

        volvo_cogp   = prod["volvo"]["cogp_cost"]
        cummins_cogp = prod["cummins"]["cogp_cost"]
        tulc_cogp    = prod.get("tulc", {}).get("cogp_cost", 0.0)
    
        volvo_qty   = prod["volvo"]["quantity"]
        cummins_qty = prod["cummins"]["quantity"]
        tulc_qty    = prod.get("tulc", {}).get("quantity", 0)
    
        return {
            "date":               str(report_date),
            "earned_labor_hours": hours.get("earned_labor_hours", 0.0),
            "volvo": {
                "quantity":       volvo_qty,
                "target":         volvo_target,
                "production_pct": production_pct(volvo_qty, volvo_target),
                "cogp_cost":      volvo_cogp,
                "scrap_qty":      scrap["volvo"]["scrap_qty"],
                "scrap_cost":     scrap["volvo"]["scrap_cost"],
                "scrap_cogp_pct": cogp_pct(scrap["volvo"]["scrap_cost"], volvo_cogp),
                "yield_pct":      yield_["volvo"]["yield_pct"],
                "wip_actual":     volvo_wip["actual"],
                "wip_goal":       volvo_wip["goal"],
            },
            "cummins": {
                "quantity":       cummins_qty,
                "target":         cummins_target,
                "production_pct": production_pct(cummins_qty, cummins_target),
                "cogp_cost":      cummins_cogp,
                "scrap_qty":      scrap["cummins"]["scrap_qty"],
                "scrap_cost":     scrap["cummins"]["scrap_cost"],
                "scrap_cogp_pct": cogp_pct(scrap["cummins"]["scrap_cost"], cummins_cogp),
                "yield_pct":      yield_["cummins"]["yield_pct"],
                "wip_actual":     cummins_wip["actual"],
                "wip_goal":       cummins_wip["goal"],
            },
            "tulc": {
                "quantity":       tulc_qty,
                "target":         tulc_target,
                "production_pct": production_pct(tulc_qty, tulc_target),
                "cogp_cost":      tulc_cogp,
                "scrap_qty":      scrap.get("tulc", {}).get("scrap_qty",  0),
                "scrap_cost":     scrap.get("tulc", {}).get("scrap_cost", 0.0),
                "scrap_cogp_pct": cogp_pct(scrap.get("tulc", {}).get("scrap_cost", 0.0), tulc_cogp),
                "yield_pct":      yield_.get("tulc", {}).get("yield_pct", 100.0),
                "wip_actual":     tulc_wip["actual"],
               "wip_goal":       tulc_wip["goal"],
            },
            "total": {
                "yield_pct":  yield_["total"]["yield_pct"],
                "production": yield_["total"]["production"],
                "scrap":      yield_["total"]["scrap"],
            },
        }
    @staticmethod
    def get_weekly_table(
        report_date: date,
        bu_code: str,
        mode: str,
    ) -> dict:
        import calendar
        from datetime import timedelta

        def get_monday(d: date) -> date:
            return d - timedelta(days=d.weekday())

        def get_quarter_range(d: date) -> tuple[date, date]:
            month = d.month
            if month <= 4:
                start_month, end_month = 1, 4
            elif month <= 8:
                start_month, end_month = 5, 8
            else:
                start_month, end_month = 9, 12
            start = date(d.year, start_month, 1)
            last_day = calendar.monthrange(d.year, end_month)[1]
            end = date(d.year, end_month, last_day)
            return start, end

        if mode == "daily":
            monday     = get_monday(report_date)
            start_date = monday
            end_date   = monday + timedelta(days=6)
        elif mode == "weekly":
            start_date = report_date.replace(day=1)
            last_day   = calendar.monthrange(report_date.year, report_date.month)[1]
            end_date   = report_date.replace(day=last_day)
        else:
            start_date, end_date = get_quarter_range(report_date)

        today    = date.today()
        end_date = min(end_date, today)

        cache_key = f"ops:table:{bu_code}:{mode}:{report_date}"
        cached    = cache.get(cache_key)
        if cached:
            return cached

        timeout = 120 if mode == "monthly" else 60
        data = _post("/production-range", {
            "start_date": str(start_date),
            "end_date":   str(end_date),
       }, timeout=timeout)

        days_data = data.get("days", [])

        from apps.production.repositories.targets_repository import TargetsRepository
        target_cache: dict[str, int] = {}

        def get_target(d: date) -> int:
            key = str(d)
            if key not in target_cache:
                obj = TargetsRepository.get_weekly_target(d, bu_code)
                if obj:
                    day_name = DAY_MAP[d.weekday()]
                    target_cache[key] = obj.get_day_target(day_name)
                else:
                    target_cache[key] = 0
            return target_cache[key]
    
        def cogp_pct(scrap_cost: float, cogp_cost: float) -> float:
            return round((scrap_cost / cogp_cost * 100), 2) if cogp_cost > 0 else 0.0
    
        if mode == "daily":
            DAY_NAMES = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"]
            ES_NAMES  = ["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"]
    
            periods        = []
            cum_produced   = 0
            cum_target     = 0
            cum_scrap_cost = 0.0
            cum_cogp_cost  = 0.0
    
            for i in range(7):
                day      = monday + timedelta(days=i)
                day_str  = str(day)
                day_data = next((d for d in days_data if d["date"] == day_str), None)
                bu_data  = day_data[bu_code] if day_data else None
                target   = get_target(day)
                wip      = _get_wip(day, bu_code)
                is_future = day > today
                has_data  = bu_data is not None and bu_data["quantity"] > 0
    
                if not is_future:
                    produced    = bu_data["quantity"]   if bu_data else 0
                    cogp_cost   = bu_data["cogp_cost"]  if bu_data else 0.0
                    scrap_cost  = bu_data["scrap_cost"] if bu_data else 0.0
                    scrap_qty   = bu_data["scrap_qty"]  if bu_data else 0
                    cum_produced   += produced
                    cum_target     += target
                    cum_scrap_cost += scrap_cost
                    cum_cogp_cost  += cogp_cost
                else:
                    produced = cogp_cost = scrap_cost = scrap_qty = 0
    
                periods.append({
                    "label":            DAY_NAMES[i],
                    "label_es":         ES_NAMES[i],
                    "date_str":         day.strftime("%m/%d/%Y"),
                    "produced":         produced,
                    "target":           target,
                    "wip_actual":       wip["actual"],
                    "wip_goal":         wip["goal"],
                    "day_pct":          round((produced / target * 100), 1) if target > 0 and not is_future else None,
                    "cum_produced":     cum_produced   if not is_future else None,
                    "cum_target":       cum_target     if not is_future else None,
                    "cum_pct":          round((cum_produced / cum_target * 100), 1) if cum_target > 0 and not is_future else None,
                    "scrap_cogp_daily": cogp_pct(scrap_cost, cogp_cost) if not is_future else None,
                    "scrap_cogp_cum":   cogp_pct(cum_scrap_cost, cum_cogp_cost) if not is_future else None,
                    "scrap_qty":        scrap_qty if not is_future else None,
                    "has_data":         has_data,
                    "is_future":        is_future,
                })
    
            periods = [
                p for p in periods
                if p["label"] not in ("Sat", "Sun") or p["has_data"]
            ]
    
            total_target = sum(get_target(monday + timedelta(days=i)) for i in range(7))
            result = {
                "mode":    "daily",
                "bu":      bu_code,
                "periods": periods,
                "totals": {
                    "produced":       cum_produced,
                    "target":         total_target,
                    "pct":            round((cum_produced / total_target * 100), 1) if total_target > 0 else 0,
                    "scrap_cogp_cum": cogp_pct(cum_scrap_cost, cum_cogp_cost),
                },
            }
    
        elif mode == "weekly":
            from collections import defaultdict
            weeks: dict[str, dict] = {}
            week_order = []
    
            current = start_date
            while current <= end_date:
                iso      = current.isocalendar()
                week_key = f"{iso[0]}-W{iso[1]:02d}"
                monday_w = current - timedelta(days=current.weekday())
                friday_w = monday_w + timedelta(days=4)
    
                if week_key not in weeks:
                    weeks[week_key] = {
                        "label":    f"WK{iso[1]}",
                        "date_str": f"{monday_w.strftime('%m/%d')} - {friday_w.strftime('%m/%d')}",
                        "monday":   monday_w,
                        "produced": 0, "target": 0,
                        "scrap_cost": 0.0, "cogp_cost": 0.0, "scrap_qty": 0,
                    }
                    week_order.append(week_key)
    
                day_data = next((d for d in days_data if d["date"] == str(current)), None)
                bu_data  = day_data[bu_code] if day_data else None
                target   = get_target(current)
    
                if bu_data and current <= today:
                    weeks[week_key]["produced"]   += bu_data["quantity"]
                    weeks[week_key]["cogp_cost"]  += bu_data["cogp_cost"]
                    weeks[week_key]["scrap_cost"] += bu_data["scrap_cost"]
                    weeks[week_key]["scrap_qty"]  += bu_data["scrap_qty"]
                weeks[week_key]["target"] += target
    
                current += timedelta(days=1)
    
            periods      = []
            cum_produced = 0
            cum_target   = 0
            cum_scrap    = 0.0
            cum_cogp     = 0.0
    
            for wk in week_order:
                w         = weeks[wk]
                is_future = w["monday"] > today
                wip       = _get_wip(w["monday"], bu_code)
                cum_produced += w["produced"]
                cum_target   += w["target"]
                cum_scrap    += w["scrap_cost"]
                cum_cogp     += w["cogp_cost"]
    
                periods.append({
                    "label":            w["label"],
                    "label_es":         w["label"],
                    "date_str":         w["date_str"],
                    "produced":         w["produced"],
                    "target":           w["target"],
                    "wip_actual":       wip["actual"],
                    "wip_goal":         wip["goal"],
                    "day_pct":          round((w["produced"] / w["target"] * 100), 1) if w["target"] > 0 else None,
                    "cum_produced":     cum_produced,
                    "cum_target":       cum_target,
                    "cum_pct":          round((cum_produced / cum_target * 100), 1) if cum_target > 0 else None,
                    "scrap_cogp_daily": cogp_pct(w["scrap_cost"], w["cogp_cost"]),
                    "scrap_cogp_cum":   cogp_pct(cum_scrap, cum_cogp),
                    "scrap_qty":        w["scrap_qty"],
                    "has_data":         w["produced"] > 0,
                    "is_future":        is_future,
                })
    
            result = {
                "mode":    "weekly",
                "bu":      bu_code,
                "periods": periods,
                "totals": {
                    "produced":       cum_produced,
                    "target":         cum_target,
                    "pct":            round((cum_produced / cum_target * 100), 1) if cum_target > 0 else 0,
                    "scrap_cogp_cum": cogp_pct(cum_scrap, cum_cogp),
                },
            }
    
        else:  # monthly
            import calendar as cal_mod
            months: dict[str, dict] = {}
            month_order = []
    
            current = start_date
            while current <= end_date:
                month_key = current.strftime("%Y-%m")
                if month_key not in months:
                    months[month_key] = {
                        "label":    current.strftime("%b"),
                        "label_es": ["Ene","Feb","Mar","Abr","May","Jun",
                                     "Jul","Ago","Sep","Oct","Nov","Dic"][current.month - 1],
                        "date_str": current.strftime("%b %Y"),
                        "first":    date(current.year, current.month, 1),
                        "produced": 0, "target": 0,
                        "scrap_cost": 0.0, "cogp_cost": 0.0, "scrap_qty": 0,
                    }
                    month_order.append(month_key)
    
                day_data = next((d for d in days_data if d["date"] == str(current)), None)
                bu_data  = day_data[bu_code] if day_data else None
                target   = get_target(current)
    
                if bu_data and current <= today:
                    months[month_key]["produced"]   += bu_data["quantity"]
                    months[month_key]["cogp_cost"]  += bu_data["cogp_cost"]
                    months[month_key]["scrap_cost"] += bu_data["scrap_cost"]
                    months[month_key]["scrap_qty"]  += bu_data["scrap_qty"]
                months[month_key]["target"] += target
    
                current += timedelta(days=1)
    
            periods      = []
            cum_produced = 0
            cum_target   = 0
            cum_scrap    = 0.0
            cum_cogp     = 0.0
    
            for mk in month_order:
                m         = months[mk]
                wip       = _get_wip(m["first"], bu_code)
                cum_produced += m["produced"]
                cum_target   += m["target"]
                cum_scrap    += m["scrap_cost"]
                cum_cogp     += m["cogp_cost"]
    
                periods.append({
                    "label":            m["label"],
                    "label_es":         m["label_es"],
                    "date_str":         m["date_str"],
                    "produced":         m["produced"],
                    "target":           m["target"],
                    "wip_actual":       wip["actual"],
                    "wip_goal":         wip["goal"],
                    "day_pct":          round((m["produced"] / m["target"] * 100), 1) if m["target"] > 0 else None,
                    "cum_produced":     cum_produced,
                    "cum_target":       cum_target,
                    "cum_pct":          round((cum_produced / cum_target * 100), 1) if cum_target > 0 else None,
                    "scrap_cogp_daily": cogp_pct(m["scrap_cost"], m["cogp_cost"]),
                    "scrap_cogp_cum":   cogp_pct(cum_scrap, cum_cogp),
                    "scrap_qty":        m["scrap_qty"],
                    "has_data":         m["produced"] > 0,
                    "is_future":        False,
                })
    
            result = {
                "mode":    "monthly",
                "bu":      bu_code,
                "periods": periods,
                "totals": {
                    "produced":       cum_produced,
                    "target":         cum_target,
                    "pct":            round((cum_produced / cum_target * 100), 1) if cum_target > 0 else 0,
                    "scrap_cogp_cum": cogp_pct(cum_scrap, cum_cogp),
                },
            }
    
        cache.set(cache_key, result, CACHE_TTL)
        return result

    