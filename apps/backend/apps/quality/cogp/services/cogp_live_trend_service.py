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
from apps.quality.cogp.services.speed_customer_classification import resolve_speed_scrap_bu

logger = logging.getLogger(__name__)


def _date_windows(start_date: date, end_date: date, chunk_days: int) -> list[tuple[date, date]]:
    windows: list[tuple[date, date]] = []
    cursor = start_date
    while cursor <= end_date:
        window_end = min(cursor + timedelta(days=chunk_days - 1), end_date)
        windows.append((cursor, window_end))
        cursor = window_end + timedelta(days=1)
    return windows


def _resolve_bu_for_live_scrap(
    workcenter_group: str | None,
    workcenter: str | None,
    part_no: str | None,
    part_to_bu: dict[str, str],
) -> str | None:
    if workcenter_group == "Speed":
        return resolve_speed_scrap_bu(workcenter, part_no, part_to_bu)
    return resolve_bu_from_workcenter(workcenter_group, workcenter)


def _resolve_bu_for_live_production(
    workcenter: str | None,
    workcenter_group: str | None,
    part_no: str | None,
    part_to_bu: dict[str, str],
) -> str:
    if workcenter_group == "Speed":
        base_part_no = str(part_no or "").strip().split(".")[0]
        return part_to_bu.get(base_part_no, BusinessUnit.SPEED)
    return resolve_bu_for_production(workcenter)


class CogpLiveTrendService:
    """
    Calcula tendencia semanal de COGP en vivo, directo desde Plex (via
    proxy), sin persistir scrap/produccion en Postgres.

    Filtro opcional de workcenter (workcenter_filter): si se pasa, solo se
    cuentan eventos cuyo Workcenter este en ese set -- aplicado ANTES de
    la clasificacion por BU, asi que reduce lo que entra a cada tarjeta
    (incluyendo Global), no selecciona una BU especifica.
    """

    CHUNK_DAYS = 168
    MAX_FETCH_CHUNKS = 6

    GLOBAL_BUS = {
        BusinessUnit.VOLVO, BusinessUnit.CUMMINS, BusinessUnit.TULC,
        BusinessUnit.JOHN_DEERE, BusinessUnit.EATON,
    }

    def __init__(
        self,
        client: QualityPlexClient | None = None,
        repository: CogpRepository | None = None,
    ):
        self.client = client or QualityPlexClient()
        self.repository = repository or CogpRepository()

    def get_weekly_trend(
        self,
        start_date: date,
        end_date: date,
        workcenter_filter: tuple[str, ...] = (),
    ) -> dict:
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

        wc_filter_set = set(workcenter_filter) if workcenter_filter else None

        cost_model_key = self.client.get_cogp_cost_model()["cost_model_key"]
        part_to_bu = self.repository.get_all_part_to_bu_map()

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
            wc_name = row.get("Workcenter")
            if wc_filter_set is not None and wc_name not in wc_filter_set:
                continue

            report_date = (
                datetime.fromisoformat(row["Report_Date"]).date()
                if isinstance(row["Report_Date"], str) else row["Report_Date"]
            )
            bu = _resolve_bu_for_live_scrap(
                row.get("Workcenter_Group"), wc_name,
                row.get("Part_No"), part_to_bu,
            )
            if bu is None:
                continue
            entry = get_bucket(bu, report_date)
            entry["scrap_cost"] += Decimal(str(row.get("Extended_Cost") or 0))

        for row in production_rows:
            wc_name = row.get("Workcenter")
            if wc_filter_set is not None and wc_name not in wc_filter_set:
                continue

            report_date = (
                datetime.fromisoformat(row["Report_Date"]).date()
                if isinstance(row["Report_Date"], str) else row["Report_Date"]
            )
            bu = _resolve_bu_for_live_production(
                wc_name, row.get("Workcenter_Group"),
                row.get("Part_No"), part_to_bu,
            )
            entry = get_bucket(bu, report_date)
            entry["extended_cost"] += Decimal(str(row.get("Extended_Cost") or 0))
            if bu == BusinessUnit.SPEED and entry["extended_cost"] > 0:
                logger.warning(
                    "Produccion SPEED (workcenter no clasificado: %s, Part_No=%s) en semana %s-%s: %s",
                    wc_name, row.get("Part_No"),
                    entry["iso_year"], entry["iso_week"], entry["extended_cost"],
                )

        by_bu: dict[str, list[dict]] = {
            BusinessUnit.VOLVO: [], BusinessUnit.CUMMINS: [], BusinessUnit.TULC: [],
            BusinessUnit.JOHN_DEERE: [], BusinessUnit.EATON: [],
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

            if entry["business_unit"] in self.GLOBAL_BUS:
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
            "john_deere": by_bu[BusinessUnit.JOHN_DEERE],
            "eaton": by_bu[BusinessUnit.EATON],
            "global": global_list,
        }