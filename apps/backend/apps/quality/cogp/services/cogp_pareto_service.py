from datetime import date, datetime, timedelta
from decimal import Decimal

from apps.quality.services.plex_client_quality import QualityPlexClient
from apps.quality.cogp.repositories.cogp_repository import CogpRepository
from apps.quality.models import BusinessUnit
from apps.ssi_common.bu_classification import (
    resolve_bu_from_workcenter,
    resolve_bu_for_production,
)
from apps.quality.cogp.services.speed_customer_classification import resolve_speed_scrap_bu


def _date_windows(start_date: date, end_date: date, chunk_days: int) -> list[tuple[date, date]]:
    """Parte [start_date, end_date] en ventanas cerradas de a lo sumo
    chunk_days, sin traslape y cubriendo el rango completo. Mismo patron
    que CogpLiveTrendService -- el proxy topa scrap-range/production-range
    en 180 dias por llamada."""
    windows: list[tuple[date, date]] = []
    cursor = start_date
    while cursor <= end_date:
        window_end = min(cursor + timedelta(days=chunk_days - 1), end_date)
        windows.append((cursor, window_end))
        cursor = window_end + timedelta(days=1)
    return windows


def _resolve_bu_for_pareto_scrap(
    workcenter_group: str | None,
    workcenter: str | None,
    part_no: str | None,
    part_to_bu: dict[str, str],
) -> str | None:
    if workcenter_group == "Speed":
        return resolve_speed_scrap_bu(workcenter, part_no, part_to_bu)
    return resolve_bu_from_workcenter(workcenter_group, workcenter)


def _resolve_bu_for_pareto_production(
    workcenter: str | None,
    workcenter_group: str | None,
    part_no: str | None,
    part_to_bu: dict[str, str],
) -> str:
    if workcenter_group == "Speed":
        base_part_no = str(part_no or "").strip().split(".")[0]
        return part_to_bu.get(base_part_no, BusinessUnit.SPEED)
    return resolve_bu_for_production(workcenter)


class CogpParetoService:
    """
    Desglose Pareto de scrap (por Scrap_Reason + Workcenter) para un rango
    de fechas libre, por business_unit, mas un bucket Global. Mismo
    criterio de clasificacion que CogpLiveTrendService.

    ERP Protection: mismo chunking que CogpLiveTrendService -- el proxy
    topa scrap-range/production-range en 180 dias por llamada, asi que
    rangos largos (ej. YTD) se parten en ventanas de CHUNK_DAYS=168 antes
    de llamar a Plex.
    """

    CHUNK_DAYS = 168
    MAX_FETCH_CHUNKS = 6

    ALL_BUS = (
        BusinessUnit.VOLVO, BusinessUnit.CUMMINS, BusinessUnit.TULC,
        BusinessUnit.JOHN_DEERE, BusinessUnit.EATON,
    )

    def __init__(
        self,
        client: QualityPlexClient | None = None,
        repository: CogpRepository | None = None,
    ):
        self.client = client or QualityPlexClient()
        self.repository = repository or CogpRepository()

    def get_pareto(
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

        by_bu_items: dict[str, dict[tuple, Decimal]] = {bu: {} for bu in self.ALL_BUS}
        by_bu_total_scrap: dict[str, Decimal] = {bu: Decimal("0") for bu in self.ALL_BUS}

        for row in scrap_rows:
            wc_name = row.get("Workcenter")
            if wc_filter_set is not None and wc_name not in wc_filter_set:
                continue

            bu = _resolve_bu_for_pareto_scrap(
                row.get("Workcenter_Group"), wc_name, row.get("Part_No"), part_to_bu,
            )
            if bu not in by_bu_items:
                continue
            cost = Decimal(str(row.get("Extended_Cost") or 0))
            key = (row.get("Scrap_Reason") or "Sin Razon", wc_name or "")
            by_bu_items[bu][key] = by_bu_items[bu].get(key, Decimal("0")) + cost
            by_bu_total_scrap[bu] += cost

        by_bu_extended: dict[str, Decimal] = {bu: Decimal("0") for bu in self.ALL_BUS}
        for row in production_rows:
            wc_name = row.get("Workcenter")
            if wc_filter_set is not None and wc_name not in wc_filter_set:
                continue

            bu = _resolve_bu_for_pareto_production(
                wc_name, row.get("Workcenter_Group"), row.get("Part_No"), part_to_bu,
            )
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
            "start_date": start_date.isoformat(),
            "end_date": end_date.isoformat(),
            "volvo": build_bucket([BusinessUnit.VOLVO]),
            "cummins": build_bucket([BusinessUnit.CUMMINS]),
            "tulc": build_bucket([BusinessUnit.TULC]),
            "john_deere": build_bucket([BusinessUnit.JOHN_DEERE]),
            "eaton": build_bucket([BusinessUnit.EATON]),
            "global": build_bucket(list(self.ALL_BUS)),
        }