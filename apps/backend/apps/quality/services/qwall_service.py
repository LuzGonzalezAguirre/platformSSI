# apps/backend/apps/quality/services/qwall_service.py

import hashlib
import re
from collections import defaultdict
from datetime import date, datetime, timedelta
from django.core.cache import cache
from ..repositories.qwall_repository import QWallRepository
from .fail_mode_translation_service import FailModeTranslationService
from apps.ssi_common.shift import get_shift

RUNS_PER_PART_LIMIT = 10


def _row_timestamp(r: dict) -> str:
    """inspection_date (DATE) + time_start (HH:MM:SS) combinados para orden
    cronológico preciso al segundo, sin necesidad de una columna nueva en el
    proxy (started_at completo no se expone hoy en /inspections)."""
    d = str(r.get("inspection_date") or "")
    t = str(r.get("time_start") or "00:00:00")
    return f"{d}T{t}"


def _row_datetime(r: dict) -> datetime:
    return datetime.fromisoformat(_row_timestamp(r))

CACHE_TTL = 300
DEFAULT_PARETO_LIMIT = 10


def _is_test_wo(work_order) -> bool:
    """
    WO de prueba si:
    - es None / vacío
    - es 0 (int o string)
    - es solo ceros: "000000", "0000"
    - empieza con P seguido de solo ceros: "P000000", "p000"
    """
    if work_order is None:
        return True
    wo = str(work_order).strip()
    if not wo or wo == "0":
        return True
    if re.fullmatch(r"0+", wo):
        return True
    if re.fullmatch(r"[Pp]0+", wo):
        return True
    return False


def _to_date(value) -> date:
    if isinstance(value, date):
        return value
    return date.fromisoformat(str(value)[:10])


def _filter_test(rows: list[dict], include_test: bool) -> list[dict]:
    if include_test:
        return [r for r in rows if _is_test_wo(r.get("work_order"))]
    return [r for r in rows if not _is_test_wo(r.get("work_order"))]


class QWallService:

    @staticmethod
    def _cache_key(start_date: date, end_date: date, include_test: bool,
                    bu_id: int | None, locale: str) -> str:
        raw = f"qwall:{start_date}:{end_date}:test={include_test}:bu={bu_id or 'all'}:loc={locale}"
        return hashlib.md5(raw.encode()).hexdigest()

    @staticmethod
    def get_report(start_date: date, end_date: date, include_test: bool = False,
                    bu_id: int | None = None, locale: str = "es") -> dict:
        key    = QWallService._cache_key(start_date, end_date, include_test, bu_id, locale)
        cached = cache.get(key)
        if cached:
            return cached

        # ssi_PieceFlagRecords es una tabla distinta a ssi_Inspections — query
        # independiente al proxy, no se anexa al SELECT de inspecciones.
        flag_count = QWallRepository.get_flag_count(start_date, end_date, bu_id)

        rows = QWallRepository.get_inspections(start_date, end_date, bu_id)

        if not rows:
            result = QWallService._empty_response()
            result["flag_count"] = flag_count
            cache.set(key, result, CACHE_TTL)
            return result

        filtered_rows = _filter_test(rows, include_test)

        if not filtered_rows:
            result = QWallService._empty_response()
            result["flag_count"] = flag_count
            cache.set(key, result, CACHE_TTL)
            return result

        # Una sola consulta a ssi_PieceFlagRecords para todo el rango — el cruce
        # con las inspecciones se hace en memoria por inspection_id, nunca N+1.
        flag_rows = QWallRepository.get_piece_flags(start_date, end_date, bu_id)

        result = QWallService._aggregate(filtered_rows, locale, flag_rows)
        result["flag_count"] = flag_count
        cache.set(key, result, CACHE_TTL)
        return result

    # ── Changeovers: detección de secuencia de part_number por BU ──────────────
    # Implementado en Python (no SQL) — CCS/DataDirect OpenAccess no soporta
    # funciones de ventana (LAG/ROW_NUMBER) de forma confiable. Se agrupa
    # SIEMPRE por bu_id antes de ordenar cronológicamente: nunca se mezcla la
    # secuencia de distintas BU, o se producen changeovers falsos por
    # entrelazado de líneas paralelas. El total = suma de los changeovers de
    # cada BU calculados de forma independiente.
    #
    # Nota aceptada: si el rango de fechas corta un run a la mitad (el modelo
    # ya venía corriendo desde antes del inicio del rango), el primer
    # registro del período se cuenta como inicio de run aunque no lo sea
    # estrictamente — comportamiento esperado para un dashboard operativo.

    @staticmethod
    def calculate_changeovers(rows: list[dict]) -> dict:
        sorted_rows = sorted(rows, key=_row_timestamp)

        by_bu: dict = defaultdict(list)
        for r in sorted_rows:
            by_bu[r.get("bu_id")].append(r["part_number"])

        result_by_bu: dict = {}
        total_changeovers = 0
        for bu_id, part_sequence in by_bu.items():
            changeovers = 0
            run_counts: dict[str, int] = defaultdict(int)
            previous_part = None
            for part in part_sequence:
                if part != previous_part:
                    if previous_part is not None:
                        changeovers += 1
                    run_counts[part] += 1
                    previous_part = part
            result_by_bu[bu_id] = {
                "changeovers":   changeovers,
                "runs_per_part": dict(run_counts),
            }
            total_changeovers += changeovers

        return {"total_changeovers": total_changeovers, "by_bu": result_by_bu}

    @staticmethod
    def _combined_runs_per_part(changeovers: dict) -> dict[str, int]:
        """Combina runs_per_part de todas las BU en un solo mapa part_number
        → run_count (un part_number normalmente pertenece a una sola BU,
        pero se suma por si aparece en más de una agrupación)."""
        combined: dict[str, int] = defaultdict(int)
        for bu_data in changeovers["by_bu"].values():
            for part_number, count in bu_data["runs_per_part"].items():
                combined[part_number] += count
        return dict(combined)

    @staticmethod
    def _runs_ranking(changeovers: dict, limit: int = RUNS_PER_PART_LIMIT) -> list[dict]:
        combined = QWallService._combined_runs_per_part(changeovers)
        ranked = sorted(combined.items(), key=lambda kv: kv[1], reverse=True)
        return [{"part_number": pn, "run_count": c} for pn, c in ranked[:limit]]

    # ── BU Summary: inspecciones + runs + pass rate agregados por Business Unit ─
    # Usado por el dashboard cuando el filtro general está en "Todas las BU"
    # (bu_id=None). Reusa by_bu de calculate_changeovers para el run_count.

    @staticmethod
    def _bu_summary_cache_key(start_date: date, end_date: date, include_test: bool) -> str:
        raw = f"qwall:bu_summary:{start_date}:{end_date}:test={include_test}"
        return hashlib.md5(raw.encode()).hexdigest()

    @staticmethod
    def get_bu_summary(start_date: date, end_date: date, include_test: bool = False) -> dict:
        key    = QWallService._bu_summary_cache_key(start_date, end_date, include_test)
        cached = cache.get(key)
        if cached is not None:
            return cached

        rows = QWallRepository.get_inspections(start_date, end_date, None)
        filtered_rows = _filter_test(rows, include_test)

        if not filtered_rows:
            result = {"items": []}
            cache.set(key, result, CACHE_TTL)
            return result

        name_map    = {bu["bu_id"]: bu["bu_name"] for bu in QWallRepository.get_business_units()}
        changeovers = QWallService.calculate_changeovers(filtered_rows)

        stats: dict = {}
        for r in filtered_rows:
            bu_id = r.get("bu_id")
            if bu_id not in stats:
                stats[bu_id] = {"total": 0, "pass": 0}
            stats[bu_id]["total"] += 1
            if r["result"] == "PASS":
                stats[bu_id]["pass"] += 1

        items = []
        for bu_id, s in stats.items():
            run_count = sum(changeovers["by_bu"].get(bu_id, {}).get("runs_per_part", {}).values())
            items.append({
                "business_unit_id":   bu_id,
                "business_unit_name": name_map.get(bu_id, str(bu_id)),
                "inspection_count":   s["total"],
                "pass":               s["pass"],
                "fail":               s["total"] - s["pass"],
                "run_count":          run_count,
                "pass_rate":          round((s["pass"] / s["total"]) * 100, 1) if s["total"] else 0,
            })
        items.sort(key=lambda x: x["business_unit_name"])

        result = {"items": items}
        cache.set(key, result, CACHE_TTL)
        return result

    # ── Part Number Summary: inspecciones + runs + pass rate por parte ─────────
    # Reusa runs_per_part de calculate_changeovers (no se recalcula por separado).
    # Requiere business_unit_id — ya NO se calcula sobre todas las BU mezcladas.

    @staticmethod
    def _part_number_summary_cache_key(business_unit_id: int, start_date: date,
                                        end_date: date, include_test: bool) -> str:
        raw = f"qwall:part_number_summary:{business_unit_id}:{start_date}:{end_date}:test={include_test}"
        return hashlib.md5(raw.encode()).hexdigest()

    @staticmethod
    def get_part_number_summary(start_date: date, end_date: date, business_unit_id: int,
                                 include_test: bool = False) -> dict:
        if business_unit_id is None:
            raise ValueError("business_unit_id es obligatorio.")

        key    = QWallService._part_number_summary_cache_key(business_unit_id, start_date, end_date, include_test)
        cached = cache.get(key)
        if cached is not None:
            return cached

        rows = QWallRepository.get_inspections(start_date, end_date, business_unit_id)
        filtered_rows = _filter_test(rows, include_test)

        if not filtered_rows:
            result = {"business_unit_id": business_unit_id, "items": [], "lowest_pass_rate_part": None}
            cache.set(key, result, CACHE_TTL)
            return result

        changeovers = QWallService.calculate_changeovers(filtered_rows)
        items       = QWallService._part_number_summary(filtered_rows, changeovers)

        # Selección sobre el mismo dataset ya agregado — no es una query nueva.
        # Empate de pass_rate se rompe a favor de la parte con más inspecciones
        # (más representativa estadísticamente).
        lowest = min(items, key=lambda x: (x["pass_rate"], -x["inspection_count"]))

        result = {"business_unit_id": business_unit_id, "items": items, "lowest_pass_rate_part": lowest}
        cache.set(key, result, CACHE_TTL)
        return result

    @staticmethod
    def _part_number_summary(rows: list[dict], changeovers: dict) -> list[dict]:
        stats: dict[str, dict] = {}
        for r in rows:
            pn = r["part_number"]
            if pn not in stats:
                stats[pn] = {"total": 0, "pass": 0}
            stats[pn]["total"] += 1
            if r["result"] == "PASS":
                stats[pn]["pass"] += 1

        runs_combined = QWallService._combined_runs_per_part(changeovers)

        summary = [
            {
                "part_number":      pn,
                "inspection_count": s["total"],
                "run_count":        runs_combined.get(pn, 0),
                "pass_rate":        round((s["pass"] / s["total"]) * 100, 1) if s["total"] else 0,
            }
            for pn, s in stats.items()
        ]
        summary.sort(key=lambda x: x["inspection_count"], reverse=True)
        return summary

    # ── By Shift: clasificación de turno vía apps.ssi_common.shift.get_shift ───
    # No expuesto en el payload de get_report hoy (Turno B hace pretrabajo/setup,
    # no aporta valor comparativo en el dashboard principal) — se deja el
    # cálculo disponible para reuso futuro.

    @staticmethod
    def _by_shift(rows: list[dict]) -> list[dict]:
        counts = {"A": 0, "B": 0}
        for r in rows:
            shift = get_shift(_row_datetime(r))
            counts[shift] = counts.get(shift, 0) + 1
        return [{"shift": s, "count": counts[s]} for s in ("A", "B")]

    # ── Fail Rate por Inspection Point ──────────────────────────────────────────
    # Distribución de FALLAS entre puntos de inspección: de todas las piezas
    # que fallaron, en qué punto ocurrió cada falla (mismo espíritu que el
    # Pareto de fail modes, agrupando por inspection_point_id en vez de
    # fail_mode_code). Requiere su propio query — /inspections no trae
    # inspection_point_id (ver Paso 0.1c).

    @staticmethod
    def _fail_by_point_cache_key(start_date: date, end_date: date,
                                  include_test: bool, bu_id: int | None) -> str:
        raw = f"qwall:point_fails:{bu_id or 'all'}:{start_date}:{end_date}:test={include_test}"
        return hashlib.md5(raw.encode()).hexdigest()

    @staticmethod
    def get_fail_by_point(start_date: date, end_date: date, include_test: bool = False,
                           bu_id: int | None = None) -> dict:
        key    = QWallService._fail_by_point_cache_key(start_date, end_date, include_test, bu_id)
        cached = cache.get(key)
        if cached:
            return cached

        rows = QWallRepository.get_inspection_point_fails(start_date, end_date, bu_id)
        filtered_rows = _filter_test(rows, include_test)

        counts: dict[int, dict] = {}
        for r in filtered_rows:
            pid = r["inspection_point_id"]
            if pid not in counts:
                counts[pid] = {"name": r["point_name"], "count": 0}
            counts[pid]["count"] += 1

        total = sum(v["count"] for v in counts.values())
        ranked = sorted(counts.items(), key=lambda kv: kv[1]["count"], reverse=True)

        result = {
            "has_fails": total > 0,
            "items": [
                {
                    "inspection_point_id":   pid,
                    "inspection_point_name": v["name"],
                    "fail_count":            v["count"],
                    "pct_of_total_fails":    round(v["count"] / total * 100, 2) if total else 0,
                }
                for pid, v in ranked
            ],
        }
        cache.set(key, result, CACHE_TTL)
        return result

    # ── Fail modes: ranking con traducción local + fallback a CCS ──────────────

    @staticmethod
    def _rank_fail_modes(rows: list[dict], locale: str) -> list[dict]:
        translations = FailModeTranslationService.get_translations_map(locale)

        fail_mode_counter: dict[str, dict] = {}
        for r in rows:
            if r["result"] == "FAIL" and r["fail_modes"]:
                names = [n.strip() for n in r["fail_modes"].split(",") if n.strip()]
                codes = [c.strip() for c in (r.get("fail_mode_codes") or "").split(",") if c.strip()]
                for i, name in enumerate(names):
                    code = codes[i] if i < len(codes) else name
                    if code not in fail_mode_counter:
                        # Fallback obligatorio al nombre original de CCS si no hay traducción
                        fail_mode_counter[code] = {"name": translations.get(code) or name, "count": 0}
                    fail_mode_counter[code]["count"] += 1

        fail_modes_sorted = sorted(
            fail_mode_counter.items(), key=lambda kv: kv[1]["count"], reverse=True,
        )
        total_fails = sum(v["count"] for _, v in fail_modes_sorted)

        ranked = []
        running = 0
        for code, v in fail_modes_sorted:
            running += v["count"]
            ranked.append({
                "code":           code,
                "name":           v["name"],
                "count":          v["count"],
                "pct_of_total":   round(v["count"] / total_fails * 100, 2) if total_fails else 0,
                "cumulative_pct": round(running / total_fails * 100, 2) if total_fails else 0,
            })
        return ranked

    # ── Traducción a nivel de fila (mismo mapa que _rank_fail_modes, aplicado
    # ahora por fila individual — hasta hoy solo se traducía el agregado del
    # Pareto, no el campo `fail_modes` que viaja en cada renglón del reporte). ──

    @staticmethod
    def _translate_name(code: str | None, name: str | None, translations: dict[str, str]) -> str | None:
        if not code:
            return name
        return translations.get(code) or name

    @staticmethod
    def _translate_fail_modes_field(fail_modes: str, fail_mode_codes: str, translations: dict[str, str]) -> str:
        if not fail_modes:
            return fail_modes
        names = [n.strip() for n in fail_modes.split(",") if n.strip()]
        codes = [c.strip() for c in (fail_mode_codes or "").split(",") if c.strip()]
        translated = [
            QWallService._translate_name(codes[i] if i < len(codes) else None, name, translations)
            for i, name in enumerate(names)
        ]
        return ", ".join(translated)

    # ── Flags: ssi_PieceFlagRecords cruzado en memoria por inspection_id ───────
    # Una sola consulta ya trajo flag_rows para todo el rango (ver get_report) —
    # aquí solo se arma el índice y se cruza, nunca una query por inspección.

    @staticmethod
    def _flag_map(flag_rows: list[dict]) -> dict[int, dict]:
        index: dict[int, dict] = {}
        for f in flag_rows:
            inspection_id = f.get("inspection_id")
            if inspection_id is not None and inspection_id not in index:
                index[inspection_id] = f
        return index

    @staticmethod
    def _aggregate(rows: list[dict], locale: str, flag_rows: list[dict] | None = None) -> dict:
        total       = len(rows)
        pass_count  = sum(1 for r in rows if r["result"] == "PASS")
        fail_count  = total - pass_count
        pass_rate   = round((pass_count / total) * 100, 2) if total else 0

        durations    = [r["duration_seconds"] for r in rows if r["duration_seconds"]]
        avg_duration = round(sum(durations) / len(durations), 1) if durations else 0

        fail_modes_ranked = QWallService._rank_fail_modes(rows, locale)
        translations      = FailModeTranslationService.get_translations_map(locale)
        flag_index        = QWallService._flag_map(flag_rows or [])

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

        rows_serialized = []
        for r in rows:
            flag = flag_index.get(r["inspection_id"])
            rows_serialized.append({
                **r,
                "inspection_date": str(r["inspection_date"]),
                "fail_modes": QWallService._translate_fail_modes_field(
                    r.get("fail_modes", ""), r.get("fail_mode_codes", ""), translations,
                ),
                "flag_id":      flag.get("flag_id") if flag else None,
                "flag_comment": flag.get("comment") if flag else None,
                "flag_fail_mode_name": QWallService._translate_name(
                    flag.get("fail_mode_code"), flag.get("fail_mode_name"), translations,
                ) if flag else None,
            })

        changeovers = QWallService.calculate_changeovers(rows)

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
            "by_inspector":         by_inspector,
            "by_part":              by_part,
            "fail_modes":           fail_modes_ranked,
            "changeover_count":     changeovers["total_changeovers"],
            "runs_per_part":        QWallService._runs_ranking(changeovers),
            "rows":                 rows_serialized,
        }

    @staticmethod
    def _empty_response() -> dict:
        return {
            "summary":      {"total": 0, "pass": 0, "fail": 0, "pass_rate": 0,
                             "avg_duration": 0, "inspectors": 0, "part_numbers": 0},
            "by_inspector":         [],
            "by_part":              [],
            "fail_modes":           [],
            "changeover_count":     0,
            "runs_per_part":        [],
            "rows":                 [],
        }

    # ── Pareto de Top Fail Modes con granularidad (ranking único por ventana) ──

    @staticmethod
    def _pareto_cache_key(granularity: str, start_date: date, end_date: date,
                           include_test: bool, bu_id: int | None, locale: str, limit: int) -> str:
        raw = (f"qwall:pareto:{granularity}:{bu_id or 'all'}:{locale}:"
               f"{start_date}:{end_date}:test={include_test}:limit={limit}")
        return hashlib.md5(raw.encode()).hexdigest()

    @staticmethod
    def get_pareto(start_date: date, end_date: date, granularity: str = "daily",
                    include_test: bool = False, bu_id: int | None = None,
                    locale: str = "es", limit: int = DEFAULT_PARETO_LIMIT) -> dict:
        key    = QWallService._pareto_cache_key(granularity, start_date, end_date, include_test, bu_id, locale, limit)
        cached = cache.get(key)
        if cached:
            return cached

        range_start, range_end = QWallService._trend_range(granularity, start_date, end_date)
        rows = QWallRepository.get_inspections(range_start, range_end, bu_id)
        filtered_rows = _filter_test(rows, include_test)

        ranked = QWallService._rank_fail_modes(filtered_rows, locale)

        result = {
            "granularity": granularity,
            "range_start": range_start.isoformat(),
            "range_end":   range_end.isoformat(),
            "items":       ranked[:limit],
        }
        cache.set(key, result, CACHE_TTL)
        return result

    # ── Pass rate target (Postgres, valor único global, sin historial) ─────────

    @staticmethod
    def _get_pass_rate_target() -> float:
        cache_key = "qwall:pass_rate_target"
        cached    = cache.get(cache_key)
        if cached is not None:
            return cached

        from ..models import QWallSettings
        target = float(QWallSettings.get_solo().pass_rate_target)
        cache.set(cache_key, target, CACHE_TTL)
        return target

    # ── Trend ────────────────────────────────────────────────────────────────

    @staticmethod
    def _trend_cache_key(granularity: str, start_date: date, end_date: date,
                          include_test: bool, bu_id: int | None) -> str:
        raw = f"qwall:trend:{granularity}:{bu_id or 'all'}:{start_date}:{end_date}:test={include_test}"
        return hashlib.md5(raw.encode()).hexdigest()

    @staticmethod
    def _trend_range(granularity: str, start_date: date, end_date: date) -> tuple[date, date]:
        if granularity == "weekly":
            range_end = date.today()
            return range_end - timedelta(weeks=6), range_end
        if granularity == "monthly":
            range_end = date.today()
            month = range_end.month - 5
            year  = range_end.year
            while month <= 0:
                month += 12
                year  -= 1
            return date(year, month, 1), range_end
        return start_date, end_date

    @staticmethod
    def get_trend(start_date: date, end_date: date, granularity: str = "daily",
                  include_test: bool = False, bu_id: int | None = None) -> dict:
        key    = QWallService._trend_cache_key(granularity, start_date, end_date, include_test, bu_id)
        cached = cache.get(key)
        if cached:
            return cached

        target_pct = QWallService._get_pass_rate_target()
        range_start, range_end = QWallService._trend_range(granularity, start_date, end_date)
        rows = QWallRepository.get_inspections(range_start, range_end, bu_id)
        filtered_rows = _filter_test(rows, include_test)

        buckets: dict = {}
        for r in filtered_rows:
            d = _to_date(r["inspection_date"])
            if granularity == "weekly":
                iso_year, iso_week, _ = d.isocalendar()
                bucket_key = (iso_year, iso_week)
            elif granularity == "monthly":
                bucket_key = (d.year, d.month)
            else:
                bucket_key = d.isoformat()

            bucket = buckets.setdefault(bucket_key, {"total": 0, "fail": 0})
            bucket["total"] += 1
            if r["result"] == "FAIL":
                bucket["fail"] += 1

        points = []
        for bucket_key in sorted(buckets.keys()):
            b          = buckets[bucket_key]
            pass_count = b["total"] - b["fail"]
            pass_rate  = round((pass_count / b["total"]) * 100, 2) if b["total"] else 0
            status     = "on_target" if pass_rate >= target_pct else "below_target"

            point = {
                "pass_rate":   pass_rate,
                "fail_count":  b["fail"],
                "total_count": b["total"],
                "target_pct":  target_pct,
                "status":      status,
            }
            if granularity == "weekly":
                iso_year, iso_week = bucket_key
                point["period"] = date.fromisocalendar(iso_year, iso_week, 1).isoformat()
                point["week"]   = iso_week
            elif granularity == "monthly":
                yr, mo = bucket_key
                point["period"] = date(yr, mo, 1).isoformat()
            else:
                point["period"] = bucket_key
            points.append(point)

        result = {"granularity": granularity, "target_pct": target_pct, "points": points}
        cache.set(key, result, CACHE_TTL)
        return result
