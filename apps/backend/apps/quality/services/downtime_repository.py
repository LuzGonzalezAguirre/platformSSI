# apps/quality/services/downtime_repository.py
import logging
from datetime import date
from typing import Optional

import httpx
from django.conf import settings

logger = logging.getLogger(__name__)


class DowntimeRepositoryError(Exception):
    """Error de dominio al consultar el proxy de Plex para downtime logs."""
    pass


def fetch_logs(
    date_from: date,
    date_to: date,
    reason: Optional[str] = None,
) -> list[dict]:
    """
    Trae logs crudos de Part_v_Workcenter_Log vía plex-proxy
    (POST /maintenance-downtime-detail). Una sola llamada, sin loops.
    """
    payload = {
        "start_date": date_from.isoformat(),
        "end_date": date_to.isoformat(),
    }
    if reason:
        payload["reason"] = reason

    try:
        response = httpx.post(
            f"{settings.PLEX_PROXY_URL.rstrip('/')}/maintenance-downtime-detail",
            json=payload,
            headers={"Authorization": f"Bearer {settings.PLEX_PROXY_SECRET}"},
            timeout=30.0,
        )
        response.raise_for_status()
    except httpx.TimeoutException as exc:
        logger.error("Timeout consultando plex-proxy downtime-detail: %s", exc)
        raise DowntimeRepositoryError(
            "El proxy de Plex no respondió a tiempo."
        ) from exc
    except httpx.HTTPStatusError as exc:
        logger.error(
            "Error HTTP de plex-proxy downtime-detail: %s - %s",
            exc.response.status_code,
            exc.response.text,
        )
        raise DowntimeRepositoryError(
            "El proxy de Plex regresó un error."
        ) from exc
    except httpx.HTTPError as exc:
        logger.error("Error de conexión con plex-proxy downtime-detail: %s", exc)
        raise DowntimeRepositoryError(
            "No se pudo conectar al proxy de Plex."
        ) from exc

    return response.json().get("data", [])