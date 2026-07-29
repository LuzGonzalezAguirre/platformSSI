import logging
from datetime import date, timedelta

from celery import shared_task

from apps.quality.cogp.services.plex_sync_service import PlexSyncService
from apps.quality.cogp.services.cogp_calculation_service import CogpCalculationService

logger = logging.getLogger(__name__)


@shared_task(bind=True, max_retries=3, default_retry_delay=300)
def sync_cogp_daily(self, report_date_str: str | None = None):
    """
    Sincroniza scrap + produccion desde Plex y calcula COGPDailySummary
    para un report_date especifico. Si no se pasa report_date, usa el
    dia anterior (patron estandar para el beat diario -- se corre
    despues de medianoche para que el dia previo ya este completo
    en Plex).

    Re-corrible sin duplicar: los upserts usan las UniqueConstraints
    de cada modelo como key.
    """
    report_date = (
        date.fromisoformat(report_date_str)
        if report_date_str
        else date.today() - timedelta(days=1)
    )

    try:
        sync_service = PlexSyncService()
        sync_result = sync_service.sync_all_for_date(report_date)

        calc_service = CogpCalculationService()
        summary_result = calc_service.calculate_and_store_daily_summary(report_date)

        logger.info(
            "COGP sync completo para %s: scrap=%s produccion=%s cost_model=%s BUs=%s",
            report_date,
            sync_result["scrap_records"],
            sync_result["production_records"],
            sync_result["cost_model_key"],
            list(summary_result.keys()),
        )

        return {
            "report_date": report_date.isoformat(),
            "sync": sync_result,
            "summary": {
                bu: {
                    "scrap_cost": str(data["scrap_cost"]),
                    "extended_cost": str(data["extended_cost"]),
                    "cogp_pct": str(data["cogp_pct"]) if data["cogp_pct"] is not None else None,
                }
                for bu, data in summary_result.items()
            },
        }

    except Exception as exc:
        logger.error(
            "Error en sync_cogp_daily para report_date=%s: %s", report_date, exc
        )
        raise self.retry(exc=exc)


@shared_task
def backfill_cogp_range(start_date_str: str, end_date_str: str):
    """
    Ejecuta sync_cogp_daily para cada dia de un rango. Uso manual desde
    shell/management command para historico, NO para uso rutinario del
    beat -- correr dia por dia via delay() evita saturar el proxy con
    llamadas simultaneas (ERP Protection Rule: no queries paralelas
    masivas a Plex).
    """
    start = date.fromisoformat(start_date_str)
    end = date.fromisoformat(end_date_str)
    current = start
    results = []

    while current <= end:
        result = sync_cogp_daily.apply(args=[current.isoformat()])
        results.append(result.get())
        current += timedelta(days=1)

    return results