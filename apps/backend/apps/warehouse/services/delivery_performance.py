"""Delivery Performance analytics; reconciled and provisional quantities are separated."""
from collections import defaultdict
from datetime import date, datetime, timedelta
from django.core.cache import cache
from apps.warehouse.services.plex_client import PlexClient, PlexProxyError

CUSTOMERS = {
    332211: "Volvo", 332165: "Cummins Inc.", 332169: "Deere & Company",
    332170: "Elkhart Plastics Inc", 332183: "JLG Industries - Americas",
    332185: "Kautex Textron", 773112: "Girtz", 332205: "SSI Technologies, LLC",
}
# Investigative adjustment: Plex SQL component extraction showed a three-hour offset
# versus the client-displayed shipment calendar date. Not an official Plex rule.
SHIP_HOURS_OFFSET = -3

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
    return round(100 * ok / scheduled, 2) if scheduled else 0.0

def report(year):
    key = f"warehouse:delivery-performance:provisional:v1:{year}"
    raw = cache.get(key)
    if raw is None:
        raw = []
        client = PlexClient()
        for month in (1, 4, 7, 10):
            start = date(year, month, 1)
            end = (date(year + 1, 1, 1) if month == 10 else date(year, month + 3, 1)) - timedelta(days=1)
            rows = client.get_delivery_performance(start.isoformat(), end.isoformat())
            if not isinstance(rows, list):
                raise PlexProxyError("Invalid delivery response")
            raw.extend(rows)
        cache.set(key, raw, timeout=300)

    releases = {}
    for raw_row in raw:
        rid = str(raw_row.get("Release_Key") or "")
        if not rid:
            continue
        if rid not in releases:
            planned = parsed(raw_row.get("Planned_Ship_Date"))
            due = parsed(raw_row.get("Due_Date"))
            if due is None or planned is None:
                continue
            customer_no = int(raw_row.get("Customer_No") or 0)
            releases[rid] = {
                "release_key": rid, "release_no": str(raw_row.get("Release_No") or "").strip(),
                "customer": CUSTOMERS.get(customer_no, f"Customer {customer_no}"),
                "customer_no": customer_no, "part": str(raw_row.get("Part_No") or ""),
                "revision": str(raw_row.get("Revision") or ""),
                "po": str(raw_row.get("PO_No") or ""),
                "due_date": due.date().isoformat(), "planned_ship_date": planned.date().isoformat(),
                "month": due.month, "week": due.date().isocalendar().week,
                "scheduled": num(raw_row.get("Scheduled")),
                "shipped_recorded": num(raw_row.get("Quantity_Shipped")),
                "source_status": str(raw_row.get("Release_Status") or ""),
                "note": str(raw_row.get("Release_Note") or ""),
                "shipment_lines": [], "seen_lines": set(),
            }
        line_key = raw_row.get("Shipper_Line_Key")
        if line_key is None or str(line_key) in releases[rid]["seen_lines"]:
            continue
        releases[rid]["seen_lines"].add(str(line_key))
        actual = parsed(raw_row.get("Actual_Ship_Date"))
        if actual is None:
            continue
        releases[rid]["shipment_lines"].append({
            "quantity": num(raw_row.get("Shipped_Quantity")),
            "shipper": str(raw_row.get("Shipper_No") or ""),
            "actual": (actual + timedelta(hours=SHIP_HOURS_OFFSET)).date(),
            "status_key": str(raw_row.get("Shipper_Status_Key") or ""),
        })

    detail = []
    for r in releases.values():
        early = on_time = late = 0.0
        reference = date.fromisoformat(r["planned_ship_date"])
        for line in r["shipment_lines"]:
            if line["actual"] < reference:
                early += line["quantity"]
            elif line["actual"] == reference:
                on_time += line["quantity"]
            else:
                late += line["quantity"]
        line_total = early + on_time + late
        mismatch = round(r["shipped_recorded"] - line_total, 4)
        # Do not distribute EDI variances across releases without traceable shipment history.
        confirmed = abs(mismatch) < 0.0001
        detail.append({k: v for k, v in r.items() if k not in ("shipment_lines", "seen_lines", "note")} | {
            "early": early, "on_time": on_time, "late": late,
            "detail_shipped": line_total, "variance": mismatch,
            "reconciled": confirmed, "performance_pct": percentage(early + on_time, r["scheduled"]),
        })

    def aggregate(items):
        scheduled = sum(r["scheduled"] for r in items)
        early = sum(r["early"] for r in items)
        on_time = sum(r["on_time"] for r in items)
        return {"scheduled": scheduled, "early": early, "on_time": on_time,
                "late": sum(r["late"] for r in items),
                "percentage": percentage(early + on_time, scheduled),
                "unreconciled": sum(not r["reconciled"] for r in items),
                "releases": len(items)}

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
        "methodology": "provisional_ship_date_minus_3h",
        "caveat": "Not Plex-certified. Current EDI revisions and unreconciled shipment quantities may affect historical OTD.",
        "monthly_by_customer": [{"month": m, "customer": c, **aggregate(v)} for (m, c), v in sorted(month_customer.items())],
        "weekly_by_customer": [{"week": w, "customer": c, **aggregate(v)} for (w, c), v in sorted(week_customer.items())],
        "weekly": [{"week": w, **aggregate(v)} for w, v in sorted(weeks.items())],
        "monthly": [{"month": m, **aggregate(v)} for m, v in sorted(months.items())],
        "overall": aggregate(detail),
        "detail": sorted(detail, key=lambda r: (r["due_date"], r["customer"], r["release_key"])),
    }
