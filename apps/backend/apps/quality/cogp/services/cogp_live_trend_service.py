import logging
from datetime import date, datetime, timedelta
from decimal import Decimal

from apps.quality.services.plex_client_quality import QualityPlexClient
from apps.quality.cogp.repositories.cogp_repository import CogpRepository
from apps.quality.models import BusinessUnit
from apps.ssi_common.bu_classification import (
    resolve_bu_from_workcenter,
    resolve_bu_for_production,
    VOLVO_HM_WORKCENTERS,
    PRODUCTION_WORKCENTER_TO_BU,
)

logger = logging.getLogger(__name__)


def _date_windows(start_date: date, end_date: date, chunk_days: int) -> list[tuple[date, date]]:
    """Parte [start_date, end_date] en ventanas cerradas de a lo sumo
    chunk_days, sin traslape y cubriendo el rango completo."""
    windows: list[tuple[date, date]] = []
    cursor = start_date
    while cursor <= end_date:
        window_end = min(cursor + timedelta(days=chunk_days - 1), end_date)
        windows.append((cursor, window_end))
        cursor = window_end + timedelta(days=1)
    return windows


class CogpLiveTrendService:
    """
    Calcula tendencia semanal de COGP en vivo, directo desde Plex (via
    proxy), sin persistir scrap/produccion en Postgres.

    Clasificacion por fuente distinta segun el dato:
    - SCRAP: por Workcenter_Group + Workcenter (resolve_bu_from_workcenter).
    - PRODUCCION: por Workcenter terminal, fijo (resolve_bu_for_production).

    Ambas funciones viven ahora en apps.ssi_common.bu_classification --
    se reexportan arriba para no romper importadores existentes
    (ver cogp_pareto_service.py).

    ERP Protection: el proxy topa cogp/scrap-range y cogp/production-range
    en 180 dias por llamada (mismo limite documentado en ScrapRateService).
    Se usan ventanas de CHUNK_DAYS=168 para quedar holgadamente debajo. Un
    rango de un año son 3 ventanas; nunca se le pide a Plex el rango
    completo en una sola query, sin importar que "en vivo" quiera decir
    sin cache -- sigue siendo una sola pasada por ventana, no un loop por
    dia ni por workcenter.
    """

    CHUNK_DAYS = 168
    MAX_FETCH_CHUNKS = 6

    def __init__(
        self,
        client: QualityPlexClient | None = None,
        repository: CogpRepository | None = None,
    ):
        self.client = client or QualityPlexClient()
        self.repository = repository or CogpRepository()

    def get_weekly_trend(self, start_date: date, end_date: date) -> dict:
        if end_date < start_date:
            raise ValueError("end_date debe ser mayor o igual a start_date.")

        span_days = (end_date - start_date).days + 1
        max_span_days = self.CHUNK_DAYS * self.MAX_FETCH_CHUNKS
        if span_days > max_span_days:
            raise ValueError(
                f"El rango cubre {span_days} dias y el maximo es "
                f"{max_span_days} ({self.MAX_FETCH_CHUNKS} ventanas de "
                f"{self.CHUNK_DAYS} dias). Reduce el periodo solicitado."
            )

        cost_model_key = self.client.get_cogp_cost_model()["cost_model_key"]

        scrap_rows: list[dict] = []
        production_rows: list[dict] = []
        for window_start, window_end in _date_windows(start_date, end_date, self.CHUNK_DAYS):
            scrap_rows.extend(
                self.client.get_cogp_scrap_range(
                    window_start.isoformat(), window_end.isoformat()
                )
            )
            production_rows.extend(
                self.client.get_cogp_production_range(
                    window_start.isoformat(), window_end.isoformat(), cost_model_key
                )
            )

        weekly: dict[tuple, dict] = {}

        def get_bucket(bu: str, report_date) -> dict:
            iso_year, iso_week, _ = report_date.isocalendar()
            key = (bu, iso_year, iso_week)
            if key not in weekly:
                weekly[key] = {
                    "business_unit": bu, "iso_year": iso_year, "iso_week": iso_week,
                    "scrap_cost": Decimal("0"), "extended_cost": Decimal("0"),
                }
            return weekly[key]

        for row in scrap_rows:
            report_date = (
                datetime.fromisoformat(row["Report_Date"]).date()
                if isinstance(row["Report_Date"], str) else row["Report_Date"]
            )
            bu = resolve_bu_from_workcenter(
                row.get("Workcenter_Group"), row.get("Workcenter")
            )
            if bu is None:
                continue
            entry = get_bucket(bu, report_date)
            entry["scrap_cost"] += Decimal(str(row.get("Extended_Cost") or 0))

        for row in production_rows:
            report_date = (
                datetime.fromisoformat(row["Report_Date"]).date()
                if isinstance(row["Report_Date"], str) else row["Report_Date"]
            )
            bu = resolve_bu_for_production(row.get("Workcenter"))
            entry = get_bucket(bu, report_date)
            entry["extended_cost"] += Decimal(str(row.get("Extended_Cost") or 0))
            if bu == BusinessUnit.SPEED and entry["extended_cost"] > 0:
                logger.warning(
                    "Produccion SPEED (workcenter no clasificado: %s) en semana %s-%s: %s",
                    row.get("Workcenter"), entry["iso_year"], entry["iso_week"], entry["extended_cost"],
                )

        GLOBAL_BUS = {BusinessUnit.VOLVO, BusinessUnit.CUMMINS, BusinessUnit.TULC}
        by_bu: dict[str, list[dict]] = {
            BusinessUnit.VOLVO: [], BusinessUnit.CUMMINS: [], BusinessUnit.TULC: [],
        }
        global_weeks: dict[tuple, dict] = {}

        for entry in weekly.values():
            extended = entry["extended_cost"]
            cogp_pct = (entry["scrap_cost"] / extended * 100) if extended > 0 else None
            point = {
                "iso_year": entry["iso_year"], "iso_week": entry["iso_week"],
                "scrap_cost": entry["scrap_cost"], "extended_cost": extended, "cogp_pct": cogp_pct,
            }
            if entry["business_unit"] in by_bu:
                by_bu[entry["business_unit"]].append(point)

            if entry["business_unit"] in GLOBAL_BUS:
                gkey = (entry["iso_year"], entry["iso_week"])
                if gkey not in global_weeks:
                    global_weeks[gkey] = {
                        "iso_year": entry["iso_year"], "iso_week": entry["iso_week"],
                        "scrap_cost": Decimal("0"), "extended_cost": Decimal("0"),
                    }
                global_weeks[gkey]["scrap_cost"] += entry["scrap_cost"]
                global_weeks[gkey]["extended_cost"] += entry["extended_cost"]

        for bu_list in by_bu.values():
            bu_list.sort(key=lambda p: (p["iso_year"], p["iso_week"]))

        global_list = []
        for g in sorted(global_weeks.values(), key=lambda r: (r["iso_year"], r["iso_week"])):
            extended = g["extended_cost"]
            g["cogp_pct"] = (g["scrap_cost"] / extended * 100) if extended > 0 else None
            global_list.append(g)

        return {
            "volvo": by_bu[BusinessUnit.VOLVO],
            "cummins": by_bu[BusinessUnit.CUMMINS],
            "tulc": by_bu[BusinessUnit.TULC],
            "global": global_list,
        }