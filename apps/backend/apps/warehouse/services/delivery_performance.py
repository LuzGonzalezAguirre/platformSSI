"""Delivery Performance (To Promise / Volume) by Plex release.

The proxy returns shipment allocations per release, including unique EDI matches.
Plex footer OTD is the arithmetic mean of release OTDs, not a quantity-weighted ratio.
"""
from collections import defaultdict
from datetime import date, datetime, timedelta

from django.core.cache import cache

from apps.warehouse.services.plex_client import PlexClient, PlexProxyError


def parsed(value):
    if isinstance(value, datetime):
        return value
    if isinstance(value, date):
        return datetime.combine(value, datetime.min.time())
    if value:
        return datetime.fromisoformat(str(value).replace("Z", "+00:00"))
    return None


def num(value):
    return float(value or 0)


def percentage(ok, scheduled):
    return 100.0 * ok / scheduled if scheduled else 0.0


REQUIRED_PROXY_COLUMNS = frozenset({
    "Release_Key", "Planned_Ship_Date", "Scheduled", "Quantity_Shipped",
    "Early", "On_Time", "Late", "Customer_Name",
    "Delivery_Performance_Raw", "Unattributed_Quantity",
})

def validate_proxy_rows(rows):
    if not isinstance(rows, list):
        raise PlexProxyError("Invalid delivery response: expected a list")
    for row in rows:
        if not isinstance(row, dict):
            raise PlexProxyError("Invalid delivery response: expected release objects")
        missing = REQUIRED_PROXY_COLUMNS.difference(row)
        if missing:
            raise PlexProxyError(
                "Incompatible Plex proxy delivery-performance response. "
                "Update/restart plex-proxyO and verify PLEX_PROXY_URL. "
                f"Missing fields: {', '.join(sorted(missing))}"
            )

def report(year):
    key = f"warehouse:delivery-performance:to-promise-v3:{year}"
    raw = cache.get(key)
    if raw is None:
        raw = []
        client = PlexClient()
        for month in (1, 4, 7, 10):
            start = date(year, month, 1)
            end = (date(year + 1, 1, 1) if month == 10
                   else date(year, month + 3, 1)) - timedelta(days=1)
            rows = client.get_delivery_performance(start.isoformat(), end.isoformat())
            validate_proxy_rows(rows)
            raw.extend(rows)
        validate_proxy_rows(raw)
        cache.set(key, raw, timeout=300)
    else:
        validate_proxy_rows(raw)

    detail = []
    seen_releases = set()
    for row in raw:
        rid = str(row.get("Release_Key") or "")
        if not rid or rid in seen_releases:
            continue
        planned = parsed(row.get("Planned_Ship_Date"))
        due = parsed(row.get("Due_Date"))
        if planned is None or due is None or planned.year != year:
            continue
        seen_releases.add(rid)
        shipped = num(row.get("Quantity_Shipped"))
        early = num(row.get("Early"))
        on_time = num(row.get("On_Time"))
        late = num(row.get("Late"))
        scheduled = num(row.get("Scheduled"))
        variance = num(row.get("Quantity_Difference"))
        unattributed = num(row.get("Unattributed_Quantity"))
        customer_no = int(row.get("Customer_No") or 0)
        detail.append({
            "release_key": rid,
            "release_no": str(row.get("Release_No") or "").strip(),
            "customer": str(row.get("Customer_Name") or f"Customer {customer_no}"),
            "customer_no": customer_no,
            "part": str(row.get("Part_No") or ""),
            "revision": str(row.get("Revision") or ""),
            "po": str(row.get("PO_No") or ""),
            "due_date": due.date().isoformat(),
            "planned_ship_date": planned.date().isoformat(),
            "month": planned.month,
            "week": planned.date().isocalendar().week,
            "scheduled": scheduled,
            "shipped_recorded": shipped,
            "source_status": "",
            "early": early,
            "on_time": on_time,
            "late": late,
            "detail_shipped": early + on_time + late,
            "variance": variance,
            "unattributed_quantity": unattributed,
            "reconciled": abs(unattributed) < 0.0001,
            "performance_pct": percentage(early + on_time, scheduled),
        })

    def aggregate(items):
        scheduled = sum(r["scheduled"] for r in items)
        early = sum(r["early"] for r in items)
        on_time = sum(r["on_time"] for r in items)
        return {
            "scheduled": scheduled,
            "early": early,
            "on_time": on_time,
            "late": sum(r["late"] for r in items),
            "percentage": round(sum(r["performance_pct"] for r in items) / len(items), 2) if items else 0.0,
            "unreconciled": sum(not r["reconciled"] for r in items),
            "releases": len(items),
        }

    month_customer = defaultdict(list)
    week_customer = defaultdict(list)
    weeks = defaultdict(list)
    months = defaultdict(list)
    for r in detail:
        month_customer[(r["month"], r["customer"])].append(r)
        week_customer[(r["week"], r["customer"])].append(r)
        weeks[r["week"]].append(r)
        months[r["month"]].append(r)

    return {
        "year": year,
        "methodology": "to_promise_volume_release_mean_v2",
        "caveat": "Validated against selected 2026 Plex months; timezone and complex EDI matching remain provisional.",
        "monthly_by_customer": [
            {"month": m, "customer": c, **aggregate(v)}
            for (m, c), v in sorted(month_customer.items())
        ],
        "weekly_by_customer": [
            {"week": w, "customer": c, **aggregate(v)}
            for (w, c), v in sorted(week_customer.items())
        ],
        "weekly": [{"week": w, **aggregate(v)} for w, v in sorted(weeks.items())],
        "monthly": [{"month": m, **aggregate(v)} for m, v in sorted(months.items())],
        "overall": aggregate(detail),
        "detail": sorted(detail, key=lambda r: (r["planned_ship_date"], r["customer"], r["release_key"])),
    }
