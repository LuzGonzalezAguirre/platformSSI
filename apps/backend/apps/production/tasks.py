"""PackAndShip Volvo incident detection and Teams outbox delivery.

The CCS event log is read-only. Polling is cursor-based, not date-based; the
first successful run records a silent baseline. Messages go through the same
Power Automate Adaptive Card contract used by Warehouse Demand.
"""
import logging
from datetime import datetime, timezone as dt_timezone
from zoneinfo import ZoneInfo
from urllib.parse import urlparse

import requests
from celery import shared_task
from django.conf import settings
from django.core.cache import cache
from django.db import transaction
from django.utils import timezone

from apps.production.models import PackShipIncidentCursor, PackShipIncidentAlert

logger = logging.getLogger(__name__)
SOURCE = "volvo"
MAX_ATTEMPTS = 5
BATCH_SIZE = 250
MAX_BATCHES = 8


def _enabled():
    return bool(getattr(settings, "PACK_SHIP_TEAMS_ALERTS_ENABLED", False))


def _fetch_ccs(resource, params=None):
    token = settings.QWALL_PROXY_TOKEN
    if not token:
        raise RuntimeError("QWALL_PROXY_TOKEN not configured")
    url = settings.QWALL_PROXY_URL.rstrip("/") + "/pack-and-ship/incidents/" + resource
    response = requests.get(
        url,
        params=params or {},
        headers={"Authorization": f"Bearer {token}"},
        timeout=25,
    )
    response.raise_for_status()
    body = response.json()
    if not isinstance(body, dict) or not isinstance(body.get("data"), list):
        raise RuntimeError("Invalid PackAndShip incident response from QWall proxy")
    return body["data"]


def _tijuana_detected_at(value):
    """CCS detection timestamps are UTC; render with the plant's timezone.

    SQL Server datetime values usually arrive as ISO timestamps without a zone.
    As in the report endpoints, treat those values as UTC, not server-local.
    """
    if value is None or not str(value).strip():
        return "—"
    if isinstance(value, datetime):
        parsed = value
    else:
        raw = str(value).strip()
        try:
            parsed = datetime.fromisoformat(raw.replace("Z", "+00:00"))
        except ValueError:
            return raw[:100]
    if parsed.tzinfo is None:
        parsed = parsed.replace(tzinfo=dt_timezone.utc)
    local = parsed.astimezone(ZoneInfo("America/Tijuana"))
    return local.strftime("%d/%m/%Y %I:%M:%S %p") + " (Tijuana)"


def _approval_departments(row):
    """Only announce departments actually supplied by a verified CCS source."""
    raw = row.get("approval_departments") or []
    if isinstance(raw, str):
        raw = [x.strip() for x in raw.split(",") if x.strip()]
    if not isinstance(raw, (list, tuple)):
        return []
    return list(dict.fromkeys(str(item).strip() for item in raw if str(item).strip()))


def build_pack_ship_incident_card(row):
    """Power Automate Adaptive Card, with CCS event_id retained only in metadata."""
    event_id = int(row["event_id"])
    departments = _approval_departments(row)
    def display(value, limit=250):
        return (str(value).strip()[:limit] if value is not None and str(value).strip() else "—")

    facts = [
        ("No. de Lote", row.get("container_code")),
        ("Tipo de incidencia", row.get("rejection_type")),
        ("Motivo", row.get("rejection_reason")),
        ("Detectado", _tijuana_detected_at(row.get("detected_at"))),
        ("Operador", row.get("detected_by")),
        ("Estado", row.get("approval_status")),
        ("Serial SSI", row.get("ssi_scan")),
        ("Serial cliente", row.get("client_scan")),
    ]
    # Show no invented departments if CCS does not yet expose the approval
    # configuration for this rejection. 'Pending' is not an approver list.
    if departments:
        facts.append(("Se espera aprobación de", ", ".join(departments)))
    else:
        facts.append(("Se espera aprobación de", "Departamentos por consultar en configuración CCS"))

    card = {
        "$schema": "http://adaptivecards.io/schemas/adaptive-card.json",
        "type": "AdaptiveCard",
        "version": "1.4",
        "msteams": {"width": "Full"},
        "body": [
            {"type": "Container", "style": "accent", "bleed": True, "items": [
                {"type": "TextBlock", "text": "PACK AND SHIP VOLVO",
                 "weight": "Bolder", "size": "Medium", "color": "Accent"},
                {"type": "TextBlock", "text": "Nueva incidencia de escaneo",
                 "weight": "Bolder", "size": "Large", "wrap": True},
            ]},
            {"type": "FactSet", "facts": [
                {"title": title, "value": display(value)} for title, value in facts
            ]},
        ],
    }
    return {
        "tipo_alerta": "PACK_SHIP_INCIDENT",
        "event_id": event_id,
        "rejection_id": int(row["rejection_id"]),
        "container_code": display(row.get("container_code"), 32),
        "attachments": [{
            "contentType": "application/vnd.microsoft.card.adaptive",
            "content": card,
        }],
    }


@shared_task(name="apps.production.tasks.monitor_pack_ship_incidents")
def monitor_pack_ship_incidents():
    if not _enabled():
        return {"status": "disabled"}
    lock = "production:pack-ship-volvo:incident-poll"
    if not cache.add(lock, "1", timeout=180):
        return {"status": "busy"}
    try:
        with transaction.atomic():
            # The single-row cursor guards against historical floods on first
            # enable. Seed only after successfully reading the proxy.
            cursor = PackShipIncidentCursor.objects.select_for_update().filter(source=SOURCE).first()
            if cursor is None:
                head = _fetch_ccs("alert-head")
                if len(head) != 1:
                    raise RuntimeError("Invalid incident head response")
                last_event_id = int(head[0]["last_event_id"])
                PackShipIncidentCursor.objects.create(
                    source=SOURCE, last_event_id=last_event_id,
                )
                return {"status": "seeded", "last_event_id": last_event_id, "queued": 0}

        queued = scanned = 0
        for _ in range(MAX_BATCHES):
            with transaction.atomic():
                cursor = PackShipIncidentCursor.objects.select_for_update().get(source=SOURCE)
                previous = cursor.last_event_id
                rows = _fetch_ccs("alert-feed", {
                    "after_event_id": previous, "limit": BATCH_SIZE,
                })
                if not rows:
                    break
                last_id = previous
                for row in rows:
                    event_id = int(row["event_id"])
                    if event_id <= last_id:
                        raise RuntimeError("Non-ascending event_id in CCS incident feed")
                    last_id = event_id
                    _, new = PackShipIncidentAlert.objects.get_or_create(
                        event_id=event_id,
                        defaults={
                            "container_code": str(row.get("container_code") or "")[:32],
                            "rejection_type": str(row.get("rejection_type") or "")[:100],
                            "payload": build_pack_ship_incident_card(row),
                        },
                    )
                    queued += int(new)
                    scanned += 1
                cursor.last_event_id = last_id
                cursor.save(update_fields=["last_event_id", "updated_at"])
            if len(rows) < BATCH_SIZE:
                break
        return {"status": "checked", "queued": queued, "scanned": scanned}
    finally:
        cache.delete(lock)


@shared_task(name="apps.production.tasks.send_pack_ship_incident_alerts")
def send_pack_ship_incident_alerts():
    if not _enabled():
        return {"status": "disabled"}
    webhook = str(getattr(settings, "PACK_SHIP_TEAMS_WEBHOOK_URL", "") or "").strip()
    if not webhook:
        return {"status": "webhook_not_configured"}
    parsed = urlparse(webhook)
    if parsed.scheme != "https" or not parsed.netloc:
        raise RuntimeError("PACK_SHIP_TEAMS_WEBHOOK_URL must be HTTPS")

    sent = 0
    for entry in PackShipIncidentAlert.objects.filter(
        status="pending", attempts__lt=MAX_ATTEMPTS,
    ).order_by("created_at")[:25]:
        with transaction.atomic():
            locked = PackShipIncidentAlert.objects.select_for_update().get(pk=entry.pk)
            if locked.status != "pending" or locked.attempts >= MAX_ATTEMPTS:
                continue
            try:
                response = requests.post(webhook, json=locked.payload, timeout=15)
                response.raise_for_status()
                locked.status = "sent"
                locked.sent_at = timezone.now()
                locked.last_error = ""
                sent += 1
            except requests.RequestException as exc:
                # Do not persist request exception text: it can contain the
                # confidential Flow URL/query token.
                locked.last_error = type(exc).__name__
                logger.warning(
                    "PackShip Teams delivery failed for event %s: %s",
                    locked.event_id, type(exc).__name__,
                )
            locked.attempts += 1
            if locked.status != "sent" and locked.attempts >= MAX_ATTEMPTS:
                locked.status = "error"
            locked.save(update_fields=["status", "attempts", "last_error", "sent_at"])
    return {"status": "checked", "sent": sent}
