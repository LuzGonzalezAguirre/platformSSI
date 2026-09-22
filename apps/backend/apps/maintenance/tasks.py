import logging
from datetime import date

from celery import shared_task

from apps.maintenance.services.maintenance_offender_service import (
    stage_weekly_maintenance_offenders,
)

logger = logging.getLogger(__name__)


@shared_task(bind=True, max_retries=2, default_retry_delay=600)
def stage_weekly_maintenance_offenders_task(
    self,
    reference_date_str: str | None = None,
):
    reference_date = (
        date.fromisoformat(reference_date_str)
        if reference_date_str
        else date.today()
    )
    try:
        result = stage_weekly_maintenance_offenders(reference_date)
        logger.info(
            "Maintenance weekly offenders %s a %s: %s staged",
            result["start_date"],
            result["end_date"],
            result["top_count"],
        )
        return result
    except Exception as exc:
        logger.error(
            "stage_weekly_maintenance_offenders_task fallo para %s: %s",
            reference_date,
            exc,
        )
        raise self.retry(exc=exc)
