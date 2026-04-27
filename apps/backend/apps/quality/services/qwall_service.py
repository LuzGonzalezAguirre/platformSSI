import hashlib
from datetime import date
from django.core.cache import cache
from ..repositories.qwall_repository import QWallRepository

CACHE_TTL = 300  # 5 min — datos de inspección no cambian en tiempo real


class QWallService:

    @staticmethod
    def _cache_key(start_date: date, end_date: date) -> str:
        raw = f"qwall:{start_date}:{end_date}"
        return hashlib.md5(raw.encode()).hexdigest()

    @staticmethod
    def get_report(start_date: date, end_date: date) -> dict:
        key    = QWallService._cache_key(start_date, end_date)
        cached = cache.get(key)
        if cached:
            return cached

        rows = QWallRepository.get_inspections(start_date, end_date)

        if not rows:
            result = QWallService._empty_response()
            cache.set(key, result, CACHE_TTL)
            return result

        result = QWallService._aggregate(rows)
        cache.set(key, result, CACHE_TTL)
        return result

    @staticmethod
    def _aggregate(rows: list[dict]) -> dict:
        total       = len(rows)
        pass_count  = sum(1 for r in rows if r["result"] == "PASS")
        fail_count  = total - pass_count
        pass_rate   = round((pass_count / total) * 100, 2) if total else 0

        # Tiempo promedio
        durations     = [r["duration_seconds"] for r in rows if r["duration_seconds"]]
        avg_duration  = round(sum(durations) / len(durations), 1) if durations else 0

        # Fail modes: solo para las filas FAIL, expandir la lista CSV
        fail_mode_counter: dict[str, int] = {}
        for r in rows:
            if r["result"] == "FAIL" and r["fail_modes"]:
                for fm in r["fail_modes"].split(","):
                    fm = fm.strip()
                    if fm:
                        fail_mode_counter[fm] = fail_mode_counter.get(fm, 0) + 1

        fail_modes_ranked = sorted(
            [{"fail_mode": k, "count": v} for k, v in fail_mode_counter.items()],
            key=lambda x: x["count"],
            reverse=True,
        )

        # Inspector performance
        inspector_stats: dict[str, dict] = {}
        for r in rows:
            name = r["inspector"]
            if name not in inspector_stats:
                inspector_stats[name] = {"total": 0, "pass": 0, "duration_sum": 0}
            inspector_stats[name]["total"] += 1
            if r["result"] == "PASS":
                inspector_stats[name]["pass"] += 1
            if r["duration_seconds"]:
                inspector_stats[name]["duration_sum"] += r["duration_seconds"]

        by_inspector = [
            {
                "inspector":    name,
                "total":        s["total"],
                "pass":         s["pass"],
                "fail":         s["total"] - s["pass"],
                "pass_rate":    round((s["pass"] / s["total"]) * 100, 1) if s["total"] else 0,
                "avg_duration": round(s["duration_sum"] / s["total"]) if s["total"] else 0,
            }
            for name, s in inspector_stats.items()
        ]

        # Part number breakdown
        part_stats: dict[str, dict] = {}
        for r in rows:
            pn = r["part_number"]
            if pn not in part_stats:
                part_stats[pn] = {"total": 0, "pass": 0}
            part_stats[pn]["total"] += 1
            if r["result"] == "PASS":
                part_stats[pn]["pass"] += 1

        by_part = [
            {
                "part_number": pn,
                "total":       s["total"],
                "pass":        s["pass"],
                "fail":        s["total"] - s["pass"],
                "pass_rate":   round((s["pass"] / s["total"]) * 100, 1) if s["total"] else 0,
            }
            for pn, s in part_stats.items()
        ]

        # Serializar fechas a string para JSON
        rows_serialized = [
            {**r, "inspection_date": str(r["inspection_date"])} for r in rows
        ]

        return {
            "summary": {
                "total":        total,
                "pass":         pass_count,
                "fail":         fail_count,
                "pass_rate":    pass_rate,
                "avg_duration": avg_duration,
                "inspectors":   len(inspector_stats),
                "part_numbers": len(part_stats),
            },
            "by_inspector":   by_inspector,
            "by_part":        by_part,
            "fail_modes":     fail_modes_ranked,
            "rows":           rows_serialized,
        }

    @staticmethod
    def _empty_response() -> dict:
        return {
            "summary":      {"total": 0, "pass": 0, "fail": 0, "pass_rate": 0,
                             "avg_duration": 0, "inspectors": 0, "part_numbers": 0},
            "by_inspector": [],
            "by_part":      [],
            "fail_modes":   [],
            "rows":         [],
        }