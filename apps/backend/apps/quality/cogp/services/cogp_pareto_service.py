from datetime import date, datetime, timedelta
from decimal import Decimal

from apps.quality.services.plex_client_quality import QualityPlexClient
from apps.quality.models import BusinessUnit
from apps.quality.cogp.services.cogp_live_trend_service import (
    resolve_bu_from_workcenter,
    resolve_bu_for_production,
)


def resolve_period_range(period: str, reference_date: date) -> tuple[date, date]:
    """
    Calcula el rango [start, end] inclusive segun el tipo de periodo.
    week = semana ISO (lunes-domingo) que contiene reference_date.
    month = mes calendario completo que contiene reference_date.
    day = el dia mismo.
    """
    if period == "day":
        return reference_date, reference_date

    if period == "week":
        start = reference_date - timedelta(days=reference_date.weekday())
        end = start + timedelta(days=6)
        return start, end

    if period == "month":
        start = reference_date.replace(day=1)
        if start.month == 12:
            next_month = start.replace(year=start.year + 1, month=1)
        else:
            next_month = start.replace(month=start.month + 1)
        end = next_month - timedelta(days=1)
        return start, end

    raise ValueError(f"period invalido: {period}")


class CogpParetoService:
    """
    Calcula el desglose Pareto de scrap (por Scrap_Reason + Workcenter)
    para un periodo dado (dia/semana/mes), por business_unit, mas un
    bucket Global (Volvo+Cummins+TULC). Reutiliza la misma clasificacion
    por workcenter que CogpLiveTrendService -- scrap por
    resolve_bu_from_workcenter, produccion por resolve_bu_for_production.
    """

    def __init__(self, client: QualityPlexClient | None = None):
        self.client = client or QualityPlexClient()

    def get_pareto(self, period: str, reference_date: date) -> dict:
        start, end = resolve_period_range(period, reference_date)
        cost_model_key = self.client.get_cogp_cost_model()["cost_model_key"]

        scrap_rows = self.client.get_cogp_scrap_range(start.isoformat(), end.isoformat())
        production_rows = self.client.get_cogp_production_range(
            start.isoformat(), end.isoformat(), cost_model_key
        )

        # Agrupar scrap por BU -> (reason, workcenter) -> costo acumulado
        by_bu_items: dict[str, dict[tuple, Decimal]] = {
            BusinessUnit.VOLVO: {}, BusinessUnit.CUMMINS: {}, BusinessUnit.TULC: {},
        }
        by_bu_total_scrap: dict[str, Decimal] = {
            BusinessUnit.VOLVO: Decimal("0"), BusinessUnit.CUMMINS: Decimal("0"),
            BusinessUnit.TULC: Decimal("0"),
        }

        for row in scrap_rows:
            bu = resolve_bu_from_workcenter(row.get("Workcenter_Group"), row.get("Workcenter"))
            if bu not in by_bu_items:
                continue
            cost = Decimal(str(row.get("Extended_Cost") or 0))
            key = (row.get("Scrap_Reason") or "Sin Razon", row.get("Workcenter") or "")
            by_bu_items[bu][key] = by_bu_items[bu].get(key, Decimal("0")) + cost
            by_bu_total_scrap[bu] += cost

        # Produccion total por BU en el periodo (para scrap rate %)
        by_bu_extended: dict[str, Decimal] = {
            BusinessUnit.VOLVO: Decimal("0"), BusinessUnit.CUMMINS: Decimal("0"),
            BusinessUnit.TULC: Decimal("0"),
        }
        for row in production_rows:
            bu = resolve_bu_for_production(row.get("Workcenter"))
            if bu in by_bu_extended:
                by_bu_extended[bu] += Decimal(str(row.get("Extended_Cost") or 0))

        def build_bucket(bu_keys: list[str]) -> dict:
            merged_items: dict[tuple, Decimal] = {}
            total_scrap = Decimal("0")
            total_extended = Decimal("0")
            for bu in bu_keys:
                for key, cost in by_bu_items[bu].items():
                    merged_items[key] = merged_items.get(key, Decimal("0")) + cost
                total_scrap += by_bu_total_scrap[bu]
                total_extended += by_bu_extended[bu]

            items_sorted = sorted(merged_items.items(), key=lambda kv: kv[1], reverse=True)
            items = [
                {
                    "reason": reason,
                    "workcenter": workcenter,
                    "cost": cost,
                    "pct_of_total": (cost / total_scrap * 100) if total_scrap > 0 else Decimal("0"),
                }
                for (reason, workcenter), cost in items_sorted
            ]
            scrap_rate_pct = (total_scrap / total_extended * 100) if total_extended > 0 else None

            return {
                "total_scrap": total_scrap,
                "total_extended_cost": total_extended,
                "scrap_rate_pct": scrap_rate_pct,
                "items": items,
            }

        return {
            "period": period,
            "start_date": start.isoformat(),
            "end_date": end.isoformat(),
            "volvo": build_bucket([BusinessUnit.VOLVO]),
            "cummins": build_bucket([BusinessUnit.CUMMINS]),
            "tulc": build_bucket([BusinessUnit.TULC]),
            "global": build_bucket([BusinessUnit.VOLVO, BusinessUnit.CUMMINS, BusinessUnit.TULC]),
        }