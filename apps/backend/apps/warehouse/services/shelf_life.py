"""Read-only shelf life analytics from the configured Plex proxy."""
from collections import Counter, defaultdict
from datetime import date, datetime
from decimal import Decimal
from django.core.cache import cache

from apps.warehouse.services.plex_client import PlexClient, PlexProxyError


def _date(value):
    if isinstance(value, datetime):
        return value.date()
    if isinstance(value, date):
        return value
    if isinstance(value, str):
        try:
            return date.fromisoformat(value[:10])
        except ValueError:
            return None
    return None


def shelf_life_report(as_of=None, horizon=30):
    reference = as_of or date.today()
    key = "warehouse:shelf-life:v1"
    rows = cache.get(key)
    if rows is None:
        rows = PlexClient().get_shelf_life()
        if not isinstance(rows, list):
            raise PlexProxyError("Invalid shelf-life response from Plex proxy")
        cache.set(key, rows, timeout=300)

    detail = []
    totals = Counter()
    locations = defaultdict(lambda: Counter())
    parts = defaultdict(lambda: Counter())
    for record in rows:
        serial = str(record.get("Serial_No") or "").strip()
        location = str(record.get("Location") or "").strip()
        expiry = _date(record.get("Expired_Date"))
        shelf = _date(record.get("Shelf_Date"))
        try:
            qty = float(record.get("Quantity") or 0)
        except (TypeError, ValueError):
            qty = 0
        if not serial or not location.upper().startswith("TJR") or qty <= 0:
            continue
        days = (expiry - reference).days if expiry else None
        state = ("unknown" if days is None else
                 "expired" if days < 0 else
                 "expiring" if days <= horizon else "ok")
        totals[state] += 1
        locations[location][state] += 1
        part = str(record.get("Part_Key") or "")
        parts[part][state] += 1
        detail.append({
            "serial_no": serial, "part_key": part, "location": location,
            "quantity": qty, "container_status": record.get("Container_Status"),
            "shelf_date": shelf.isoformat() if shelf else None,
            "expired_date": expiry.isoformat() if expiry else None,
            "days_remaining": days, "status": state,
        })
    detail.sort(key=lambda r: (r["days_remaining"] is None,
                               r["days_remaining"] if r["days_remaining"] is not None else 999999,
                               r["serial_no"]))
    total = len(detail)
    return {
        "as_of": reference.isoformat(),
        "horizon_days": horizon,
        "summary": {
            "total": total, "expired": totals["expired"], "expiring": totals["expiring"],
            "ok": totals["ok"], "unknown": totals["unknown"],
            "expired_pct": round(100 * totals["expired"] / total, 2) if total else 0,
            "at_risk": totals["expired"] + totals["expiring"],
        },
        "locations": [
            {"location": name, **{state: count[state] for state in ("expired", "expiring", "ok", "unknown")},
             "total": sum(count.values())}
            for name, count in sorted(locations.items())
        ],
        "parts": sorted([
            {"part_key": part, "expired": count["expired"], "expiring": count["expiring"],
             "total": sum(count.values())}
            for part, count in parts.items()
        ], key=lambda item: (-item["expired"], -item["expiring"], item["part_key"])),
        "containers": detail,
    }
