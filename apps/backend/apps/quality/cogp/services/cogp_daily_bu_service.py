"""
Agregacion DIARIA de COGP por Business Unit desde los endpoints de rango del
proxy (cogp/scrap-range, cogp/production-range), clasificada en Django con
apps.ssi_common.bu_classification.

Existe para que el Ops Daily Report y el modulo de Calidad publiquen el MISMO
numero. Antes el Ops Report leia /scrap-cogp y /daily-production, donde la
clasificacion por BU vive dentro del proxy: dos reglas para el mismo dato, y
nadie sabe cual creer en la junta de la manana.

ERP Protection: dos queries ODBC por RANGO (scrap + produccion), nunca una por
dia. El cache es granular por dia, asi que pedir la semana con 6 dias calientes
trae unicamente el dia faltante. El numero de queries depende del ANCHO del
rango, no del volumen de datos, y esta acotado por MAX_FETCH_CHUNKS.
"""
import logging
from datetime import date, datetime, timedelta
from decimal import Decimal, ROUND_HALF_UP

from django.core.cache import cache

from apps.quality.models import BusinessUnit
from apps.quality.services.plex_client_quality import QualityPlexClient
from apps.quality.cogp.repositories.cogp_repository import CogpRepository
from apps.quality.cogp.services.speed_customer_classification import resolve_speed_scrap_bu
from apps.warehouse.services.plex_client import PlexProxyError
from apps.ssi_common.bu_classification import (
    resolve_bu_from_workcenter,
    resolve_bu_for_production,
)

logger = logging.getLogger(__name__)

# Mapeo BusinessUnit -> llave publica del payload del Ops Report.
# Explicito a proposito: el contrato con el frontend no debe depender del
# valor interno del enum.
BU_KEYS: dict[str, str] = {
    BusinessUnit.VOLVO: "volvo",
    BusinessUnit.CUMMINS: "cummins",
    BusinessUnit.TULC: "tulc",
    BusinessUnit.JOHN_DEERE: "john_deere",
    BusinessUnit.EATON: "eaton",
}

TRACKED_KEYS = tuple(BU_KEYS.values())


def _resolve_bu_for_daily_scrap(
    workcenter_group: str | None,
    workcenter: str | None,
    part_no: str | None,
    part_to_bu: dict[str, str],
) -> str | None:
    """
    Extension de resolve_bu_from_workcenter para el grupo Speed -- mismo
    criterio que CogpLiveTrendService: por Workcenter (no Part_No), porque
    partes de empaque compartido entre John Deere/Eaton hacen que Part_No
    no sea confiable para SCRAP (ver speed_customer_classification.py).
    """
    if workcenter_group == "Speed":
        return resolve_speed_scrap_bu(workcenter, part_no, part_to_bu)
    return resolve_bu_from_workcenter(workcenter_group, workcenter)


def _resolve_bu_for_daily_production(
    workcenter: str | None,
    workcenter_group: str | None,
    part_no: str | None,
    part_to_bu: dict[str, str],
) -> str:
    """
    Extension de resolve_bu_for_production para Speed -- por Part_No via
    CustomerPartMapping, mismo criterio que CogpLiveTrendService (los
    workcenters terminales de Speed ya son exclusivos por cliente, asi
    que aqui Part_No es confiable).
    """
    if workcenter_group == "Speed":
        base_part_no = str(part_no or "").strip().split(".")[0]
        return part_to_bu.get(base_part_no, BusinessUnit.SPEED)
    return resolve_bu_for_production(workcenter)


def empty_day() -> dict:
    return {
        key: {"scrap_cost": 0.0, "scrap_qty": 0, "extended_cost": 0.0}
        for key in TRACKED_KEYS
    }


def _to_int_qty(raw) -> int:
    """Quantity llega como int, float, Decimal o str segun el driver."""
    if raw is None:
        return 0
    try:
        return int(Decimal(str(raw)).quantize(Decimal("1"), rounding=ROUND_HALF_UP))
    except (ArithmeticError, ValueError):
        logger.warning("Quantity no parseable descartada: %r", raw)
        return 0


def _to_decimal(raw) -> Decimal:
    if raw is None:
        return Decimal("0")
    try:
        return Decimal(str(raw))
    except (ArithmeticError, ValueError):
        logger.warning("Costo no parseable descartado: %r", raw)
        return Decimal("0")


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


class CogpDailyBuService:
    """
    Buckets diarios {fecha_iso: {bu_key: {scrap_cost, scrap_qty, extended_cost}}}.

    Clasificacion por fuente, igual que CogpLiveTrendService:
      - SCRAP:      Workcenter_Group + Workcenter (resolve_bu_from_workcenter),
                     con extension a Part_No dentro de Speed via
                     _resolve_bu_for_daily_scrap.
      - PRODUCCION: Workcenter terminal fijo (resolve_bu_for_production),
                     con extension a Part_No dentro de Speed via
                     _resolve_bu_for_daily_production.

    Los costos se devuelven como float para que el payload sea JSON-safe y
    consistente con lo que el Ops Report ya publica. La aritmetica interna es
    Decimal; el redondeo ocurre una sola vez, al cerrar el dia.
    """

    # Subir al cambiar la forma del bucket o al invalidar datos malos.
    # v2 = agrega John Deere/Eaton (2026-08-26).
    CACHE_VERSION = "v2"

    TTL_CLOSED_DAY = 604800   # 7 dias -- un dia cerrado casi no cambia
    TTL_OPEN_DAY = 600        # 10 min -- hoy y ayer siguen recibiendo capturas
    OPEN_DAY_LOOKBACK = 1     # cuantos dias hacia atras se consideran "abiertos"

    # El proxy topa los endpoints de rango en 180 dias. 168 = 24 semanas.
    CHUNK_DAYS = 168
    MAX_FETCH_CHUNKS = 6

    def __init__(
        self,
        client: QualityPlexClient | None = None,
        repository: CogpRepository | None = None,
    ):
        self.client = client or QualityPlexClient()
        self.repository = repository or CogpRepository()

    # ── cache ────────────────────────────────────────────────────────

    def _day_key(self, day: date) -> str:
        return f"cogp:daily:{self.CACHE_VERSION}:{day.isoformat()}"

    def _is_open(self, day: date, today: date) -> bool:
        return day >= today - timedelta(days=self.OPEN_DAY_LOOKBACK)

    def _write_cache(self, days: dict[str, dict], today: date) -> None:
        closed: dict[str, dict] = {}
        open_: dict[str, dict] = {}
        for day_str, bucket in days.items():
            day = date.fromisoformat(day_str)
            target = open_ if self._is_open(day, today) else closed
            target[self._day_key(day)] = bucket
        if closed:
            cache.set_many(closed, timeout=self.TTL_CLOSED_DAY)
        if open_:
            cache.set_many(open_, timeout=self.TTL_OPEN_DAY)

    # ── entrypoint ───────────────────────────────────────────────────

    def get_daily_buckets(self, start_date: date, end_date: date) -> dict[str, dict]:
        if end_date < start_date:
            raise ValueError("end_date no puede ser anterior a start_date.")

        today = date.today()
        end_date = min(end_date, today)
        if end_date < start_date:
            return {}

        span = (end_date - start_date).days + 1
        wanted = [start_date + timedelta(days=i) for i in range(span)]

        result: dict[str, dict] = {}
        missing: list[date] = []
        for day in wanted:
            cached = cache.get(self._day_key(day))
            if cached is not None:
                result[day.isoformat()] = cached
            else:
                missing.append(day)

        if missing:
            fetched = self._fetch_and_bucket(missing[0], missing[-1])
            self._write_cache(fetched, today)
            for day in missing:
                result[day.isoformat()] = fetched.get(day.isoformat(), empty_day())

        return dict(sorted(result.items()))

    # ── fetch ────────────────────────────────────────────────────────

    def _date_windows(self, start: date, end: date) -> list[tuple[date, date]]:
        windows: list[tuple[date, date]] = []
        cursor = start
        while cursor <= end:
            window_end = min(cursor + timedelta(days=self.CHUNK_DAYS - 1), end)
            windows.append((cursor, window_end))
            cursor = window_end + timedelta(days=1)
        if len(windows) > self.MAX_FETCH_CHUNKS:
            raise ValueError(
                f"El rango requiere {len(windows)} ventanas al ERP y el maximo "
                f"es {self.MAX_FETCH_CHUNKS}. Reduce el periodo solicitado."
            )
        return windows

    def _fetch_and_bucket(self, start: date, end: date) -> dict[str, dict]:
        days: dict[str, dict] = {}
        cost_model_key = self.client.get_cogp_cost_model()["cost_model_key"]
        part_to_bu = self.repository.get_all_part_to_bu_map()

        total_scrap_rows = 0
        total_production_rows = 0

        for window_start, window_end in self._date_windows(start, end):
            scrap_rows = self.client.get_cogp_scrap_range(
                window_start.isoformat(), window_end.isoformat()
            )
            production_rows = self.client.get_cogp_production_range(
                window_start.isoformat(), window_end.isoformat(), cost_model_key
            )
            self._bucket_scrap(scrap_rows, days, start, end, part_to_bu)
            self._bucket_production(production_rows, days, start, end, part_to_bu)
            total_scrap_rows += len(scrap_rows)
            total_production_rows += len(production_rows)

        # Guard: Plex devolvio filas y nada aterrizo en ningun bucket. Cachear
        # esto congela ceros por 7 dias y la pantalla miente sin error visible.
        # Un cero falso es peor que un error: el error lo reportan, el cero lo
        # creen y lo llevan a la junta.
        rows_seen = total_scrap_rows + total_production_rows
        value_seen = sum(
            bucket[k]["scrap_cost"] + bucket[k]["extended_cost"] + bucket[k]["scrap_qty"]
            for bucket in days.values()
            for k in TRACKED_KEYS
        )
        if rows_seen > 0 and value_seen == 0:
            raise PlexProxyError(
                f"CogpDailyBu: {rows_seen} filas recibidas de Plex y 0 valor "
                f"clasificado ({start} a {end}) -- revisar mapeo de workcenters "
                f"y nombres de columna del proxy."
            )

        logger.info(
            "CogpDailyBu: %s dias calculados desde Plex (%s a %s), "
            "%s filas scrap / %s filas produccion.",
            len(days), start, end, total_scrap_rows, total_production_rows,
        )
        return days

    # ── bucketing ────────────────────────────────────────────────────

    def _get_day(self, days: dict, report_date: date) -> dict:
        key = report_date.isoformat()
        if key not in days:
            days[key] = empty_day()
        return days[key]

    def _bucket_scrap(
        self, rows: list[dict], days: dict, start: date, end: date,
        part_to_bu: dict[str, str],
    ) -> None:
        for row in rows:
            report_date = _normalize_report_date(row.get("Report_Date"))
            if report_date is None or not (start <= report_date <= end):
                continue

            bu = _resolve_bu_for_daily_scrap(
                row.get("Workcenter_Group"), row.get("Workcenter"),
                row.get("Part_No"), part_to_bu,
            )
            bu_key = BU_KEYS.get(bu)
            if bu_key is None:
                continue

            target = self._get_day(days, report_date)[bu_key]
            target["scrap_cost"] = float(
                (_to_decimal(target["scrap_cost"]) + _to_decimal(row.get("Extended_Cost")))
                .quantize(Decimal("0.0001"), rounding=ROUND_HALF_UP)
            )
            target["scrap_qty"] += _to_int_qty(row.get("Quantity"))

    def _bucket_production(
        self, rows: list[dict], days: dict, start: date, end: date,
        part_to_bu: dict[str, str],
    ) -> None:
        unclassified: set[str] = set()

        for row in rows:
            report_date = _normalize_report_date(row.get("Report_Date"))
            if report_date is None or not (start <= report_date <= end):
                continue

            workcenter = row.get("Workcenter")
            bu = _resolve_bu_for_daily_production(
                workcenter, row.get("Workcenter_Group"),
                row.get("Part_No"), part_to_bu,
            )
            bu_key = BU_KEYS.get(bu)
            if bu_key is None:
                unclassified.add(str(workcenter))
                continue

            target = self._get_day(days, report_date)[bu_key]
            target["extended_cost"] = float(
                (_to_decimal(target["extended_cost"]) + _to_decimal(row.get("Extended_Cost")))
                .quantize(Decimal("0.0001"), rounding=ROUND_HALF_UP)
            )

        if unclassified:
            logger.warning(
                "CogpDailyBu: produccion descartada por workcenter no clasificado "
                "(cae en SPEED): %s. Revisar PRODUCTION_WORKCENTER_TO_BU.",
                ", ".join(sorted(unclassified)),
            )