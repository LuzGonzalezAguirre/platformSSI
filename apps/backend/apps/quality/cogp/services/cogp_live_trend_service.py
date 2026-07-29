import logging
from datetime import date, datetime
from decimal import Decimal

from apps.quality.services.plex_client_quality import QualityPlexClient
from apps.quality.cogp.repositories.cogp_repository import CogpRepository
from apps.quality.models import BusinessUnit

logger = logging.getLogger(__name__)

VOLVO_HM_WORKCENTERS = {"HM Ensamble Final 2", "HM Ensamble Frontal 2"}

PRODUCTION_WORKCENTER_TO_BU = {
    "HM Ensamble Final 2": BusinessUnit.VOLVO,
    "HM Ensamble de Servicio": BusinessUnit.CUMMINS,
    "TULC Ensamble Final": BusinessUnit.TULC,
}


def resolve_bu_from_workcenter(workcenter_group: str, workcenter: str) -> str | None:
    """
    Clasificacion de SCRAP por Workcenter_Group + Workcenter. Confirmado
    sesion 2026-07-29: dentro de 'Heater Module', HM Ensamble Final 2 y
    HM Ensamble Frontal 2 son Volvo; el resto de Heater Module es Cummins.
    'TULC' como Workcenter_Group va directo a TULC sin importar el
    workcenter especifico. Molding y ambos grupos 'Speed' quedan fuera
    del scope por ahora (excluidos ya desde el query del proxy).
    """
    if workcenter_group == "TULC":
        return BusinessUnit.TULC
    if workcenter_group == "Heater Module":
        if workcenter in VOLVO_HM_WORKCENTERS:
            return BusinessUnit.VOLVO
        return BusinessUnit.CUMMINS
    return None


def resolve_bu_for_production(workcenter: str) -> str:
    """
    Clasificacion de PRODUCCION por workcenter terminal, fija y sin
    ambiguedad (confirmado sesion 2026-07-29): HM Ensamble Final 2=VOLVO,
    HM Ensamble de Servicio=CUMMINS, TULC Ensamble Final=TULC. No usa
    Part_No/CustomerPartMapping -- se abandono ese criterio porque nombres
    de Plex como "Cummins/SSI Standard TULC sensor s/a" son ambiguos y
    clasificaban mal produccion real de TULC como Cummins.
    """
    return PRODUCTION_WORKCENTER_TO_BU.get(workcenter, BusinessUnit.SPEED)


class CogpLiveTrendService:
    """
    Calcula tendencia semanal de COGP en vivo, directo desde Plex (via
    proxy), sin persistir scrap/produccion en Postgres.

    Clasificacion por fuente distinta segun el dato:
    - SCRAP: por Workcenter_Group + Workcenter (resolve_bu_from_workcenter).
    - PRODUCCION: por Workcenter terminal, fijo (resolve_bu_for_production).
    """

    def __init__(
        self,
        client: QualityPlexClient | None = None,
        repository: CogpRepository | None = None,
    ):
        self.client = client or QualityPlexClient()
        self.repository = repository or CogpRepository()

    def get_weekly_trend(self, start_date: date, end_date: date) -> dict:
        cost_model_key = self.client.get_cogp_cost_model()["cost_model_key"]

        scrap_rows = self.client.get_cogp_scrap_range(
            start_date.isoformat(), end_date.isoformat()
        )
        production_rows = self.client.get_cogp_production_range(
            start_date.isoformat(), end_date.isoformat(), cost_model_key
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