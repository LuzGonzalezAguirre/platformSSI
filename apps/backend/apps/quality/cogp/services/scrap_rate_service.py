# apps/quality/cogp/services/scrap_rate_service.py
import logging
import time
from datetime import date, datetime, timedelta
from decimal import Decimal, ROUND_HALF_UP

from django.core.cache import cache

from apps.quality.models import BusinessUnit
from apps.quality.services.plex_client_quality import QualityPlexClient
from apps.warehouse.services.plex_client import PlexProxyError
from apps.ssi_common.bu_classification import (
    resolve_bu_for_finished_goods,
    TERMINAL_WORKCENTERS,
)

logger = logging.getLogger(__name__)

GLOBAL_KEY = "GLOBAL"

TRACKED_BUS = (BusinessUnit.VOLVO, BusinessUnit.CUMMINS, BusinessUnit.TULC)

ALLOWED_BUSINESS_UNITS = frozenset({*TRACKED_BUS, GLOBAL_KEY})

# Part_Type de Plex que representan producto terminado. Con el filtro por
# workcenter terminal este desglose es casi redundante -- se conserva porque
# un workcenter terminal puede scrapear un componente cargado en la misma
# estacion, y esa distincion sigue siendo util para el ingeniero de calidad.
FINISHED_PART_TYPES = frozenset({"finished good", "assembly"})


def iso_week_spine(start_date: date, end_date: date) -> list[dict]:
    """
    Genera TODAS las semanas ISO (lunes-domingo) que tocan el rango, sin
    saltarse ninguna. El rango se expande a semanas completas: si start_date
    cae un miercoles, la semana entera se incluye -- un reporte semanal no
    puede mostrar semanas parciales en el pasado sin mentir sobre el volumen.
    """
    monday = start_date - timedelta(days=start_date.weekday())
    spine: list[dict] = []
    while monday <= end_date:
        iso_year, iso_week, _ = monday.isocalendar()
        spine.append({
            "iso_year": iso_year,
            "iso_week": iso_week,
            "week_start": monday,
            "week_end": monday + timedelta(days=6),
        })
        monday += timedelta(days=7)
    return spine


def _empty_bucket() -> dict:
    return {
        bu: {"produced_qty": 0, "scrap_qty": 0, "scrap_qty_finished": 0}
        for bu in (*TRACKED_BUS, GLOBAL_KEY)
    }


def _to_int_qty(raw) -> int:
    """
    Quantity de Plex puede llegar como int, float, Decimal o str segun el
    driver. Se normaliza a entero con redondeo half-up -- son piezas, no
    fracciones, y truncar hacia cero perderia scrap real en filas decimales.
    """
    if raw is None:
        return 0
    try:
        return int(Decimal(str(raw)).quantize(Decimal("1"), rounding=ROUND_HALF_UP))
    except (ArithmeticError, ValueError):
        logger.warning("Quantity no parseable descartada: %r", raw)
        return 0


def _normalize_report_date(raw) -> date | None:
    if isinstance(raw, date) and not isinstance(raw, datetime):
        return raw
    if isinstance(raw, datetime):
        return raw.date()
    if isinstance(raw, str):
        try:
            return datetime.fromisoformat(raw.replace("Z", "+00:00")).date()
        except ValueError:
            logger.warning("Report_Date no parseable descartada: %r", raw)
            return None
    return None


def _pct(numerator: int, denominator: int) -> str | None:
    """
    Porcentaje con 4 decimales como string, o None si el denominador es 0.
    Nunca devuelve "0.0000" por ausencia de datos: sin input, la tasa es
    indefinida, no cero. El frontend depende de esta distincion para cortar
    la linea en lugar de bajarla al piso.
    """
    if denominator <= 0:
        return None
    value = (Decimal(numerator) / Decimal(denominator)) * Decimal(100)
    return str(value.quantize(Decimal("0.0001"), rounding=ROUND_HALF_UP))


class ScrapRateService:
    """
    Tendencia semanal de scrap rate EN PIEZAS, por business unit, calculada
    en vivo desde Plex via proxy con cache Redis granular por semana ISO.

    ALCANCE (v3): la metrica se calcula EXCLUSIVAMENTE sobre workcenters
    terminales de producto terminado (ver TERMINAL_WORKCENTERS). Scrap y
    produccion se clasifican con la MISMA funcion,
    resolve_bu_for_finished_goods, y ambos descartan lo no terminal.

    Esto es intencional y cambia el significado del indicador:

      - ANTES: scrap de toda la planta (incluyendo molding, subensambles y
        componentes) contra produccion de unidades terminadas. Numerador y
        denominador en granos distintos -> tasas de 35-47% sin sentido
        fisico.

      - AHORA: scrap de producto terminado contra produccion de producto
        terminado. Es un YIELD del punto terminal, comparable consigo mismo
        semana a semana.

    ESTE NUMERO NO ES EL COGP. El COGP en costo (cogp_live_trend_service)
    sigue contando scrap de toda la planta, porque un componente scrapeado
    en molding cuesta dinero real aunque no sea una unidad terminada. Los
    dos indicadores van a diferir y ambos son correctos -- miden cosas
    distintas. La UI debe etiquetarlo como scrap rate de producto terminado
    o alguien va a "conciliarlos" y perder una tarde.

    Definicion:
        input_qty      = produced_qty + scrap_qty
        scrap_rate_pct = scrap_qty / input_qty * 100

    Con ambos lados en el mismo grano, produced+scrap como denominador ya
    no es solo una cota defensiva: es literalmente el input de la estacion
    terminal, y la fraccion coloreada de la barra apilada es exactamente
    el rate.

    ERP Protection: el numero de queries depende del ANCHO del rango, no
    del volumen de datos, y esta acotado por MAX_FETCH_CHUNKS. Un ano son
    3 ventanas; con cache caliente, la semana en curso es 1. El filtrado
    por workcenter es en Python, post-fetch: NO se agrega una query por
    workcenter.

    DEPENDENCIA ABIERTA: requiere que cogp/scrap-range y
    cogp/production-range devuelvan la columna Quantity. Mientras el proxy
    solo devuelva Extended_Cost, el guard de _fetch_and_bucket levanta
    PlexProxyError en lugar de cachear ceros.
    """

    MAX_WEEKS = 104
    TTL_CLOSED_WEEK = 604800   # 7 dias -- cubre reprocesos tardios en Plex
    TTL_CURRENT_WEEK = 600     # 10 min -- la semana en curso sigue moviendose
    LOCK_TTL = 60
    LOCK_WAIT_SECONDS = 0.5
    LOCK_RETRIES = 3

    # El proxy topa cogp/scrap-range en 180 dias. Se usan 168 (24 semanas
    # exactas) para quedar holgadamente debajo. NO subir el limite del
    # proxy: existe para que nadie le pida a Plex un rango de anos desde
    # una pantalla web.
    CHUNK_DAYS = 168

    # Techo duro de ventanas por request. Con MAX_WEEKS=104 (728 dias) el
    # peor caso son 5 ventanas = 10 queries ODBC en cache frio.
    MAX_FETCH_CHUNKS = 6

    # Versionado del cache: incrementar al cambiar la forma del bucket, la
    # regla de clasificacion, o al invalidar datos malos.
    #   v2 = purga de los ceros cacheados cuando el proxy no devolvia Quantity.
    #   v3 = scrap restringido a workcenters terminales (mismo criterio que
    #        produccion). Todo lo cacheado en v2 tiene el numerador inflado.
    CACHE_VERSION = "v3"

    def __init__(self, client: QualityPlexClient | None = None):
        self.client = client or QualityPlexClient()

    # ── cache keys ───────────────────────────────────────────────────

    def _week_key(self, iso_year: int, iso_week: int) -> str:
        return f"cogp:sr:{self.CACHE_VERSION}:wk:{iso_year}:{iso_week:02d}"

    def _lock_key(self, first: dict, last: dict) -> str:
        return (
            f"cogp:sr:{self.CACHE_VERSION}:lock:"
            f"{first['iso_year']}{first['iso_week']:02d}-"
            f"{last['iso_year']}{last['iso_week']:02d}"
        )

    # ── entrypoint ───────────────────────────────────────────────────

    def get_weekly_scrap_rate(
        self,
        start_date: date,
        end_date: date,
        business_unit: str = GLOBAL_KEY,
    ) -> dict:
        if business_unit not in ALLOWED_BUSINESS_UNITS:
            raise ValueError(
                f"business_unit invalido: {business_unit}. "
                f"Validos: {', '.join(sorted(ALLOWED_BUSINESS_UNITS))}."
            )

        spine = iso_week_spine(start_date, end_date)
        if not spine:
            raise ValueError("El rango no cubre ninguna semana ISO completa.")
        if len(spine) > self.MAX_WEEKS:
            raise ValueError(
                f"El rango cubre {len(spine)} semanas y el maximo es "
                f"{self.MAX_WEEKS}. Reduce el periodo solicitado."
            )

        today = date.today()
        key_by_week = {
            (w["iso_year"], w["iso_week"]): self._week_key(w["iso_year"], w["iso_week"])
            for w in spine
        }

        cached = cache.get_many(list(key_by_week.values()))

        # Semanas enteramente futuras no se consultan ni se cachean: se
        # devuelven en ceros con rate None. Un 0.00% en una semana que aun
        # no ocurre le dice al gerente que salio perfecta.
        missing = [
            w for w in spine
            if key_by_week[(w["iso_year"], w["iso_week"])] not in cached
            and w["week_start"] <= today
        ]

        weeks_from_plex = 0
        if missing:
            fetched = self._resolve_missing_weeks(missing, today)
            cached.update({
                key_by_week[wk]: bucket for wk, bucket in fetched.items()
            })
            weeks_from_plex = len(fetched)

        weeks_payload = []
        total_produced = 0
        total_scrap = 0

        for w in spine:
            bucket = cached.get(
                key_by_week[(w["iso_year"], w["iso_week"])], _empty_bucket()
            )
            bu_data = bucket.get(
                business_unit,
                {"produced_qty": 0, "scrap_qty": 0, "scrap_qty_finished": 0},
            )

            produced = bu_data["produced_qty"]
            scrap = bu_data["scrap_qty"]
            scrap_finished = bu_data["scrap_qty_finished"]
            input_qty = produced + scrap

            total_produced += produced
            total_scrap += scrap

            weeks_payload.append({
                "iso_year": w["iso_year"],
                "iso_week": w["iso_week"],
                "label": f"WK{w['iso_week']}-{w['iso_year'] % 100:02d}",
                "week_start": w["week_start"].isoformat(),
                "week_end": w["week_end"].isoformat(),
                "produced_qty": produced,
                "scrap_qty": scrap,
                "scrap_qty_finished": scrap_finished,
                "input_qty": input_qty,
                "scrap_rate_pct": _pct(scrap, input_qty),
                "scrap_rate_finished_pct": _pct(
                    scrap_finished, produced + scrap_finished
                ),
                "has_input": input_qty > 0,
                "is_partial": w["week_start"] <= today <= w["week_end"],
                "is_future": w["week_start"] > today,
            })

        total_input = total_produced + total_scrap

        return {
            "business_unit": business_unit,
            "start_date": spine[0]["week_start"].isoformat(),
            "end_date": spine[-1]["week_end"].isoformat(),
            "requested_start_date": start_date.isoformat(),
            "requested_end_date": end_date.isoformat(),
            "weeks": weeks_payload,
            "totals": {
                "produced_qty": total_produced,
                "scrap_qty": total_scrap,
                "input_qty": total_input,
                "scrap_rate_pct": _pct(total_scrap, total_input),
            },
            "meta": {
                "source": "plex_live",
                "scope": "finished_goods_workcenters",
                "workcenters": sorted(TERMINAL_WORKCENTERS),
                "weeks_total": len(spine),
                "weeks_from_cache": len(spine) - weeks_from_plex,
                "weeks_from_plex": weeks_from_plex,
            },
        }

    # ── resolucion de semanas faltantes ──────────────────────────────

    def _resolve_missing_weeks(self, missing: list[dict], today: date) -> dict:
        """
        Adquiere un lock sobre el rango faltante para evitar estampida
        (varios usuarios abriendo la pantalla con cache frio no deben
        disparar la misma query pesada a Plex N veces). Si otro proceso
        tiene el lock, se espera y se reintenta leer del cache; si tras los
        reintentos sigue faltando, se calcula igual -- es preferible una
        query duplicada a una pantalla en blanco.
        """
        first, last = missing[0], missing[-1]
        lock_key = self._lock_key(first, last)

        if cache.add(lock_key, 1, self.LOCK_TTL):
            try:
                return self._fetch_and_bucket(missing, today)
            finally:
                cache.delete(lock_key)

        pending = missing
        for _ in range(self.LOCK_RETRIES):
            time.sleep(self.LOCK_WAIT_SECONDS)
            keys = {
                (w["iso_year"], w["iso_week"]): self._week_key(w["iso_year"], w["iso_week"])
                for w in pending
            }
            found = cache.get_many(list(keys.values()))
            pending = [
                w for w in pending
                if keys[(w["iso_year"], w["iso_week"])] not in found
            ]
            if not pending:
                all_keys = {
                    (w["iso_year"], w["iso_week"]): self._week_key(w["iso_year"], w["iso_week"])
                    for w in missing
                }
                refreshed = cache.get_many(list(all_keys.values()))
                return {
                    wk: refreshed[key]
                    for wk, key in all_keys.items()
                    if key in refreshed
                }

        logger.info(
            "Lock %s no liberado tras %s reintentos, calculando de todas formas.",
            lock_key, self.LOCK_RETRIES,
        )
        return self._fetch_and_bucket(pending, today)

    # ── fetch ────────────────────────────────────────────────────────

    def _date_windows(self, start: date, end: date) -> list[tuple[date, date]]:
        """
        Parte [start, end] en ventanas de a lo mas CHUNK_DAYS dias. Esto NO
        es un loop de queries por item: el numero de ventanas depende del
        ancho del rango, no del volumen de datos, y esta acotado por
        MAX_FETCH_CHUNKS.
        """
        windows: list[tuple[date, date]] = []
        cursor = start
        while cursor <= end:
            window_end = min(cursor + timedelta(days=self.CHUNK_DAYS - 1), end)
            windows.append((cursor, window_end))
            cursor = window_end + timedelta(days=1)

        if len(windows) > self.MAX_FETCH_CHUNKS:
            raise ValueError(
                f"El rango requiere {len(windows)} consultas al ERP y el maximo "
                f"es {self.MAX_FETCH_CHUNKS}. Reduce el periodo solicitado."
            )
        return windows

    def _fetch_and_bucket(self, missing: list[dict], today: date) -> dict:
        """
        Trae scrap y produccion en ventanas de CHUNK_DAYS y las acumula en
        los mismos buckets. Partir una semana entre dos ventanas es
        inofensivo: el bucketing es por Report_Date y las cantidades se
        suman, no se reemplazan.
        """
        fetch_start = missing[0]["week_start"]
        fetch_end = min(missing[-1]["week_end"], today)

        wanted = {(w["iso_year"], w["iso_week"]) for w in missing}
        buckets: dict[tuple, dict] = {wk: _empty_bucket() for wk in wanted}

        windows = self._date_windows(fetch_start, fetch_end)
        cost_model_key = self.client.get_cogp_cost_model()["cost_model_key"]

        total_scrap_rows = 0
        total_production_rows = 0
        total_scrap_discarded = 0
        missing_qty_column = False

        for window_start, window_end in windows:
            scrap_rows = self.client.get_cogp_scrap_range(
                window_start.isoformat(), window_end.isoformat()
            )
            production_rows = self.client.get_cogp_production_range(
                window_start.isoformat(), window_end.isoformat(), cost_model_key
            )

            if scrap_rows and "Quantity" not in scrap_rows[0]:
                missing_qty_column = True
            if production_rows and "Quantity" not in production_rows[0]:
                missing_qty_column = True

            total_scrap_discarded += self._bucket_scrap(scrap_rows, buckets, wanted)
            self._bucket_production(production_rows, buckets, wanted)

            total_scrap_rows += len(scrap_rows)
            total_production_rows += len(production_rows)

        # Guard: Plex devolvio filas y nada aterrizo en los buckets.
        # Cachear esto congela ceros durante 7 dias y la pantalla miente sin
        # error visible. En una pantalla de calidad un cero falso es peor
        # que un error: el error lo reportan, el cero lo creen.
        rows_seen = total_scrap_rows + total_production_rows
        qty_seen = sum(
            b[bu]["produced_qty"] + b[bu]["scrap_qty"]
            for b in buckets.values()
            for bu in TRACKED_BUS
        )
        if rows_seen > 0 and qty_seen == 0:
            detail = (
                "el proxy no devuelve la columna Quantity"
                if missing_qty_column
                else "revisar mapeo de workcenters terminales y nombres de columna"
            )
            raise PlexProxyError(
                f"ScrapRate: {rows_seen} filas recibidas de Plex y 0 piezas "
                f"clasificadas ({fetch_start} a {fetch_end}) -- {detail}."
            )

        for bucket in buckets.values():
            g = bucket[GLOBAL_KEY]
            for bu in TRACKED_BUS:
                g["produced_qty"] += bucket[bu]["produced_qty"]
                g["scrap_qty"] += bucket[bu]["scrap_qty"]
                g["scrap_qty_finished"] += bucket[bu]["scrap_qty_finished"]

        self._write_cache(buckets, missing, today)

        logger.info(
            "ScrapRate: %s semanas calculadas desde Plex (%s a %s) en %s ventana(s), "
            "%s filas scrap / %s filas produccion. Scrap descartado por workcenter "
            "no terminal: %s piezas.",
            len(buckets), fetch_start, fetch_end, len(windows),
            total_scrap_rows, total_production_rows, total_scrap_discarded,
        )
        return buckets

    # ── bucketing ────────────────────────────────────────────────────

    def _bucket_scrap(self, rows: list[dict], buckets: dict, wanted: set) -> int:
        """
        Solo cuenta scrap reportado en workcenters TERMINALES, con la misma
        funcion de clasificacion que la produccion. El scrap de molding y
        subensambles se descarta a proposito: no tiene contraparte en el
        denominador y por eso inflaba la tasa a 35-47%.

        Devuelve la cantidad de piezas descartadas, para trazabilidad -- ese
        volumen no desaparece, sigue reflejado en el COGP en costo.
        """
        discarded = 0

        for row in rows:
            report_date = _normalize_report_date(row.get("Report_Date"))
            if report_date is None:
                continue

            iso_year, iso_week, _ = report_date.isocalendar()
            if (iso_year, iso_week) not in wanted:
                continue

            qty = _to_int_qty(row.get("Quantity"))

            bu = resolve_bu_for_finished_goods(row.get("Workcenter"))
            if bu not in buckets[(iso_year, iso_week)]:
                discarded += qty
                continue

            target = buckets[(iso_year, iso_week)][bu]
            target["scrap_qty"] += qty

            part_type = (row.get("Part_Type") or "").strip().lower()
            if part_type in FINISHED_PART_TYPES:
                target["scrap_qty_finished"] += qty

        return discarded

    def _bucket_production(self, rows: list[dict], buckets: dict, wanted: set) -> None:
        unclassified: set[str] = set()

        for row in rows:
            report_date = _normalize_report_date(row.get("Report_Date"))
            if report_date is None:
                continue

            iso_year, iso_week, _ = report_date.isocalendar()
            if (iso_year, iso_week) not in wanted:
                continue

            workcenter = row.get("Workcenter")
            bu = resolve_bu_for_finished_goods(workcenter)
            if bu not in buckets[(iso_year, iso_week)]:
                unclassified.add(str(workcenter))
                continue

            buckets[(iso_year, iso_week)][bu]["produced_qty"] += _to_int_qty(
                row.get("Quantity")
            )

        if unclassified:
            logger.debug(
                "ScrapRate: produccion descartada por workcenter no terminal: %s.",
                ", ".join(sorted(unclassified)),
            )

    # ── cache write ──────────────────────────────────────────────────

    def _write_cache(self, buckets: dict, missing: list[dict], today: date) -> None:
        """
        TTL diferenciado: una semana cerrada es practicamente inmutable y se
        guarda 7 dias; la semana en curso caduca en 10 minutos porque sigue
        recibiendo scrap y produccion.
        """
        week_meta = {(w["iso_year"], w["iso_week"]): w for w in missing}

        closed: dict[str, dict] = {}
        current: dict[str, dict] = {}

        for wk, bucket in buckets.items():
            meta = week_meta.get(wk)
            if meta is None:
                continue
            key = self._week_key(*wk)
            if meta["week_end"] < today:
                closed[key] = bucket
            else:
                current[key] = bucket

        if closed:
            cache.set_many(closed, timeout=self.TTL_CLOSED_WEEK)
        if current:
            cache.set_many(current, timeout=self.TTL_CURRENT_WEEK)