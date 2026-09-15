# apps/quality/services/downtime_repository.py
import logging
from datetime import date
from typing import Optional

import httpx
from django.conf import settings
from apps.ssi_common.plex_ranges import date_chunks

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
    Trae logs crudos de Part_v_Workcenter_Log vía plex-proxy. Los rangos
    largos se dividen para no exceder la ventana práctica del driver ODBC.
    """
    rows: list[dict] = []
    for chunk_start, chunk_end in date_chunks(date_from, date_to):
        payload = {
            "start_date": chunk_start.isoformat(),
            "end_date": chunk_end.isoformat(),
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

        rows.extend(response.json().get("data", []))

    rows.sort(key=lambda row: str(row.get("Log_Date") or row.get("log_date") or ""))
    return rows


def fetch_workcenters() -> list[dict]:
    """
    Catálogo de workcenters (Heater Module / TULC) — una sola llamada,
    usado solo por el sync de Celery Beat, no por request de usuario.
    """
    try:
        response = httpx.get(
            f"{settings.PLEX_PROXY_URL.rstrip('/')}/workcenters",
            headers={"Authorization": f"Bearer {settings.PLEX_PROXY_SECRET}"},
            timeout=30.0,
        )
        response.raise_for_status()
    except httpx.TimeoutException as exc:
        logger.error("Timeout consultando plex-proxy workcenters: %s", exc)
        raise DowntimeRepositoryError("El proxy de Plex no respondió a tiempo.") from exc
    except httpx.HTTPStatusError as exc:
        logger.error(
            "Error HTTP de plex-proxy workcenters: %s - %s",
            exc.response.status_code, exc.response.text,
        )
        raise DowntimeRepositoryError("El proxy de Plex regresó un error.") from exc
    except httpx.HTTPError as exc:
        logger.error("Error de conexión con plex-proxy workcenters: %s", exc)
        raise DowntimeRepositoryError("No se pudo conectar al proxy de Plex.") from exc

    return response.json().get("data", [])
