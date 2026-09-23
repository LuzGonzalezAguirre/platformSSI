"""Read open ActionTracker references from CCS through qwall-proxy."""

from __future__ import annotations

import logging
import requests
from django.conf import settings

logger = logging.getLogger(__name__)


def get_open_actions(source: str) -> list[dict]:
    source = (source or "").strip().lower()
    if source not in {"scrap", "maintenance"}:
        raise ValueError("source debe ser scrap o maintenance")

    proxy_url = settings.QWALL_PROXY_URL.rstrip("/")
    token = settings.QWALL_PROXY_TOKEN
    if not token:
        logger.warning("QWALL_PROXY_TOKEN no configurado; no se cargarán referencias ActionTracker.")
        return []

    request_kwargs = {
        "params": {"source": source},
        "headers": {"Authorization": f"Bearer {token}"},
        "timeout": 10,
    }

    try:
        response = requests.get(
            f"{proxy_url}/action-tracker/open-actions",
            **request_kwargs,
        )
    except requests.RequestException as exc:
        if "host.docker.internal" not in proxy_url:
            logger.warning("No se pudieron cargar acciones ActionTracker: %s", exc)
            return []
        try:
            response = requests.get(
                "http://127.0.0.1:8002/action-tracker/open-actions",
                **request_kwargs,
            )
        except requests.RequestException as retry_exc:
            logger.warning("No se pudieron cargar acciones ActionTracker: %s", retry_exc)
            return []

    try:
        response.raise_for_status()
        payload = response.json()
        return payload.get("data") or []
    except Exception as exc:
        logger.warning("Respuesta inválida al cargar acciones ActionTracker: %s", exc)
        return []


def dedupe_actions(actions: list[dict]) -> list[dict]:
    """Deduplicate by ActionTracker item id while preserving newest linkage."""
    seen: set[int] = set()
    result: list[dict] = []
    for action in actions:
        item_id = action.get("item_id")
        if item_id in seen:
            continue
        seen.add(item_id)
        result.append(action)
    return result
