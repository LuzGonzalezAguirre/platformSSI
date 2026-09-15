import json, hashlib
from collections import defaultdict
from datetime import date

from django.core.cache import cache
from .plex_client_quality import QualityPlexClient
from apps.ssi_common.plex_ranges import date_chunks
from apps.warehouse.services.plex_client import PlexProxyError


def _aggregate_scrap_payloads(payloads: list[dict], start: str, end: str, use_shift: bool) -> dict:
    """Merge additive scrap responses and recalculate percentages globally."""
    workcenters: dict[str, dict] = {}
    reasons = defaultdict(lambda: {"total_qty": 0, "total_cost": 0.0})
    parts: dict[tuple[str, str], dict] = {}
    shifts = defaultdict(int)
    trend: list[dict] = []
    total_production = 0

    for payload in payloads:
        summary = payload.get("summary") or {}
        if "total_production" not in summary:
            raise PlexProxyError(
                "plex-proxyO debe actualizarse antes de consultar scrap en rangos mayores a 168 dias"
            )
        total_production += int(summary.get("total_production") or 0)
        trend.extend(payload.get("trend") or [])

        for row in payload.get("by_workcenter") or []:
            key = row["workcenter"]
            item = workcenters.setdefault(key, {
                "workcenter": key, "bu": row.get("bu"), "production": 0,
                "scrap_qty": 0, "scrap_cost": 0.0, "shift_a_qty": 0,
                "shift_b_qty": 0,
            })
            item["production"] += int(row.get("production") or 0)
            item["scrap_qty"] += int(row.get("scrap_qty") or 0)
            item["scrap_cost"] += float(row.get("scrap_cost") or 0)
            item["shift_a_qty"] += int((row.get("shift_a") or {}).get("scrap_qty") or 0)
            item["shift_b_qty"] += int((row.get("shift_b") or {}).get("scrap_qty") or 0)

        for row in payload.get("by_reason") or []:
            item = reasons[row["scrap_reason"]]
            item["total_qty"] += int(row.get("total_qty") or 0)
            item["total_cost"] += float(row.get("total_cost") or 0)

        for row in payload.get("by_part") or []:
            key = (row["part_no"], row["workcenter"])
            item = parts.setdefault(key, {
                "part_no": row["part_no"], "part_type": row.get("part_type"),
                "workcenter": row["workcenter"], "bu": row.get("bu"),
                "scrap_qty": 0, "scrap_cost": 0.0,
            })
            item["scrap_qty"] += int(row.get("scrap_qty") or 0)
            item["scrap_cost"] += float(row.get("scrap_cost") or 0)

        for row in payload.get("by_shift") or []:
            shifts[(row["workcenter"], row["shift"])] += int(row.get("scrap_qty") or 0)

    by_workcenter = []
    for item in workcenters.values():
        prod, scrap = item["production"], item["scrap_qty"]
        shift_prod = prod * 0.5
        by_workcenter.append({
            "workcenter": item["workcenter"], "bu": item["bu"],
            "production": prod, "scrap_qty": scrap,
            "yield_pct": round(prod / (prod + scrap) * 100, 2) if prod + scrap else 100.0,
            "scrap_cost": round(item["scrap_cost"], 2),
            "shift_a": {
                "scrap_qty": item["shift_a_qty"],
                "yield_pct": round(shift_prod / (shift_prod + item["shift_a_qty"]) * 100, 2)
                if shift_prod + item["shift_a_qty"] else 100.0,
            },
            "shift_b": {
                "scrap_qty": item["shift_b_qty"],
                "yield_pct": round(shift_prod / (shift_prod + item["shift_b_qty"]) * 100, 2)
                if shift_prod + item["shift_b_qty"] else 100.0,
            },
        })
    by_workcenter.sort(key=lambda row: row["yield_pct"])

    total_scrap = sum(item["total_qty"] for item in reasons.values())
    by_reason = []
    cumulative = 0.0
    for reason, item in sorted(reasons.items(), key=lambda pair: pair[1]["total_qty"], reverse=True):
        pct = round(item["total_qty"] / total_scrap * 100, 2) if total_scrap else 0.0
        cumulative += pct
        by_reason.append({
            "scrap_reason": reason, "total_qty": item["total_qty"],
            "total_cost": round(item["total_cost"], 2), "pct_of_total": pct,
            "cumulative_pct": round(cumulative, 2),
        })

    by_part = sorted(parts.values(), key=lambda row: row["scrap_qty"], reverse=True)
    for row in by_part:
        row["scrap_cost"] = round(row["scrap_cost"], 2)

    total_cost = round(sum(row["scrap_cost"] for row in by_part), 2)
    grand_total = total_production + total_scrap
    return {
        "start_date": start, "end_date": end, "use_shift": use_shift,
        "summary": {
            "total_qty": total_scrap, "total_cost": total_cost,
            "total_production": total_production,
            "yield_pct": round(total_production / grand_total * 100, 2) if grand_total else 100.0,
        },
        "by_workcenter": by_workcenter,
        "by_reason": by_reason,
        "by_part": by_part,
        "by_shift": [
            {"workcenter": wc, "shift": shift, "scrap_qty": qty}
            for (wc, shift), qty in shifts.items()
        ],
        "trend": sorted(trend, key=lambda row: row.get("date", "")),
    }

class QualityService:
    TTL = 300

    def __init__(self):
        self.client = QualityPlexClient()

    def _cache_key(self, start: str, end: str, use_shift: bool) -> str:
        raw = json.dumps({"op": "scrap_detail", "start": start, "end": end, "shift": use_shift}, sort_keys=True)
        return f"plex:{hashlib.md5(raw.encode()).hexdigest()}"

    def get_scrap_detail(self, start_date: str, end_date: str, use_shift: bool = True) -> dict:
        key  = self._cache_key(start_date, end_date, use_shift)
        data = cache.get(key)
        if data is not None:
            return data
        chunks = list(date_chunks(date.fromisoformat(start_date), date.fromisoformat(end_date)))
        payloads = [
            self.client.get_scrap_detail(chunk_start.isoformat(), chunk_end.isoformat(), use_shift)
            for chunk_start, chunk_end in chunks
        ]
        data = payloads[0] if len(payloads) == 1 else _aggregate_scrap_payloads(
            payloads, start_date, end_date, use_shift
        )
        cache.set(key, data, timeout=self.TTL)
        return data
