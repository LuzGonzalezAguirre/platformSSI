from decimal import Decimal
from datetime import date

from apps.quality.cogp.repositories.cogp_repository import CogpRepository
from apps.quality.models import BusinessUnit


class CogpCalculationService:
    """
    Calcula y persiste COGPDailySummary a partir de ScrapRecord y
    ProductionRecord ya sincronizados en Postgres. No llama a Plex.
    """

    def __init__(self, repository: CogpRepository | None = None):
        self.repository = repository or CogpRepository()

    def calculate_and_store_daily_summary(self, report_date: date) -> dict:
        """
        Calcula scrap_cost / extended_cost por business_unit para un
        report_date especifico, y hace upsert de COGPDailySummary.
        Retorna el resultado calculado para logging/testing.
        """
        scrap_by_bu = self.repository.get_scrap_cost_by_bu(report_date, report_date)
        extended_by_bu = self.repository.get_extended_cost_by_bu(report_date, report_date)

        all_bus = set(scrap_by_bu.keys()) | set(extended_by_bu.keys())
        results = {}

        for bu in all_bus:
            scrap_cost = scrap_by_bu.get(bu, Decimal("0"))
            extended_cost = extended_by_bu.get(bu, Decimal("0"))

            # SPEED nunca deberia tener extended_cost -- si aparece,
            # es una anomalia que se loggea, no se oculta.
            if bu == BusinessUnit.SPEED and extended_cost > 0:
                import logging
                logger = logging.getLogger(__name__)
                logger.warning(
                    "SPEED (sin cliente mapeado) tiene extended_cost=%s en "
                    "report_date=%s -- revisar CustomerPartMapping, no deberia "
                    "haber produccion facturable sin cliente.",
                    extended_cost, report_date,
                )

            cogp_pct = (
                (scrap_cost / extended_cost * 100) if extended_cost > 0 else None
            )

            self.repository.upsert_daily_summary(
                report_date=report_date,
                business_unit=bu,
                scrap_cost=scrap_cost,
                extended_cost=extended_cost,
                cogp_pct=cogp_pct,
            )

            results[bu] = {
                "scrap_cost": scrap_cost,
                "extended_cost": extended_cost,
                "cogp_pct": cogp_pct,
            }

        return results

    def get_summary_for_range(self, start_date: date, end_date: date) -> dict:
        """
        Para el endpoint GET /cogp/summary/. Retorna totales agregados
        por business_unit sobre el rango, separando SPEED del resto.
        """
        totals = self.repository.get_summary_totals_by_bu(start_date, end_date)

        real_bus = {
            bu: data for bu, data in totals.items() if bu != BusinessUnit.SPEED
        }
        speed_data = totals.get(BusinessUnit.SPEED)

        return {
            "start_date": start_date,
            "end_date": end_date,
            "by_business_unit": real_bus,
            "unmapped_engineering": speed_data,  # SPEED, informativo, fuera del % real
        }

    def get_weekly_trend(self, start_date: date, end_date: date) -> dict:
        """
        Retorna tendencia semanal ISO por business_unit para las 4 tablas
        del dashboard: VOLVO, CUMMINS, TULC, y GLOBAL (suma de las 3).
        SPEED, JOHN_DEERE, HARLEY_DAVIDSON, EATON quedan fuera de Global
        -- Global es especificamente Volvo+Cummins+TULC, confirmado con Luz.
        """
        weekly_rows = self.repository.get_weekly_summary(start_date, end_date)

        GLOBAL_BUS = {BusinessUnit.VOLVO, BusinessUnit.CUMMINS, BusinessUnit.TULC}
        by_bu: dict[str, list[dict]] = {
            BusinessUnit.VOLVO: [],
            BusinessUnit.CUMMINS: [],
            BusinessUnit.TULC: [],
        }
        global_weeks: dict[tuple, dict] = {}

        for row in weekly_rows:
            bu = row["business_unit"]
            if bu in by_bu:
                by_bu[bu].append({
                    "iso_year": row["iso_year"],
                    "iso_week": row["iso_week"],
                    "scrap_cost": row["scrap_cost"],
                    "extended_cost": row["extended_cost"],
                    "cogp_pct": row["cogp_pct"],
                })

            if bu in GLOBAL_BUS:
                key = (row["iso_year"], row["iso_week"])
                if key not in global_weeks:
                    global_weeks[key] = {
                        "iso_year": row["iso_year"],
                        "iso_week": row["iso_week"],
                        "scrap_cost": Decimal("0"),
                        "extended_cost": Decimal("0"),
                    }
                global_weeks[key]["scrap_cost"] += row["scrap_cost"]
                global_weeks[key]["extended_cost"] += row["extended_cost"]

        global_list = []
        for data in sorted(global_weeks.values(), key=lambda r: (r["iso_year"], r["iso_week"])):
            extended = data["extended_cost"]
            data["cogp_pct"] = (
                (data["scrap_cost"] / extended * 100) if extended > 0 else None
            )
            global_list.append(data)

        return {
            "volvo": by_bu[BusinessUnit.VOLVO],
            "cummins": by_bu[BusinessUnit.CUMMINS],
            "tulc": by_bu[BusinessUnit.TULC],
            "global": global_list,
        }