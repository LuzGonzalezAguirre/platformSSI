"""Monthly Plex release discovery and retryable Teams delivery for Warehouse Demand."""
import logging
from datetime import timedelta
from urllib.parse import urlparse

import requests
from celery import shared_task
from django.conf import settings
from django.core.cache import cache
from django.db import transaction
from django.utils import timezone

from apps.warehouse.models import DemandAlertSyncState, DemandReleaseAlert
from apps.warehouse.services.plex_client import PlexClient

logger = logging.getLogger(__name__)
MAX_ATTEMPTS = 5


def build_demand_teams_payload(row):
    """Payload mirrors the ActionTracker Workflows contract."""
    fields = (
        ("Cliente", row.get("Customer")),
        ("PO", row.get("PO_Rel")),
        ("Parte / revisión", row.get("Part_No_Rev")),
        ("Parte cliente", row.get("Cust_Part")),
        ("Cantidad", row.get("Rel_Qty")),
        ("Fecha embarque", str(row.get("Ship_Date") or "")[:10]),
        ("Tipo", row.get("Rel_Type")),
    )
    facts = [{"title": label, "value": str(value or "—")} for label, value in fields]
    card = {
        "$schema": "http://adaptivecards.io/schemas/adaptive-card.json",
        "type": "AdaptiveCard",
        "version": "1.4",
        "msteams": {"width": "Full"},
        "body": [
            {"type": "Container", "style": "accent", "bleed": True, "items": [
                {"type": "TextBlock", "text": "WAREHOUSE · DEMAND", "weight": "Bolder", "size": "Small"},
                {"type": "TextBlock", "text": "Nuevo release registrado", "weight": "Bolder", "size": "Large", "wrap": True},
            ]},
            {"type": "FactSet", "facts": facts},
        ],
    }
    return {
        "tipo_alerta": "DEMAND_NEW_RELEASE",
        "release_key": int(row["Release_Key"]),
        "cliente": str(row.get("Customer") or ""),
        "po": str(row.get("PO_Rel") or ""),
        "parte": str(row.get("Part_No_Rev") or ""),
        "cantidad": row.get("Rel_Qty"),
        "fecha_embarque": str(row.get("Ship_Date") or "")[:10],
        "attachments": [{"contentType": "application/vnd.microsoft.card.adaptive", "content": card}],
    }


@shared_task(name="apps.warehouse.tasks.check_monthly_demand_releases")
def check_monthly_demand_releases():
    """Seed current month silently, then queue each genuinely new Release_Key."""
    lock_key = "warehouse:demand:alert-check-lock"
    if not cache.add(lock_key, "1", timeout=240):
        return {"status": "busy"}
    try:
        today = timezone.localdate()
        month_start = today.replace(day=1)
        next_month = (month_start.replace(day=28) + timedelta(days=4)).replace(day=1)
        end_day = next_month - timedelta(days=1)

        # Bypass the warehouse HTTP cache so the poll can detect fresh releases.
        rows = PlexClient().get_demand(
            customer_no=None,
            include_all_customers=True,
            release_status="All",
            ship_date_from=month_start.isoformat(),
            ship_date_to=end_day.isoformat(),
        )
        if any(row.get("Release_Key") is None for row in rows):
            raise RuntimeError("Plex /demand must return Release_Key; update plex-proxyO.")

        created = 0
        with transaction.atomic():
            # Lock protects baseline initialization even if multiple workers race.
            state, initialized = DemandAlertSyncState.objects.get_or_create(ship_month=month_start)
            for row in rows:
                key = int(row["Release_Key"])
                _, was_created = DemandReleaseAlert.objects.get_or_create(
                    release_key=key,
                    defaults={
                        "ship_month": month_start,
                        "payload": build_demand_teams_payload(row),
                        "status": "seeded" if initialized else "pending",
                    },
                )
                created += int(was_created and not initialized)
        return {"status": "seeded" if initialized else "checked", "new_releases": created}
    finally:
        cache.delete(lock_key)


@shared_task(name="apps.warehouse.tasks.send_pending_demand_teams_alerts")
def send_pending_demand_teams_alerts():
    webhook = str(getattr(settings, "DEMAND_TEAMS_WEBHOOK_URL", "") or "").strip()
    if not webhook:
        return {"status": "webhook_not_configured"}

    parts = urlparse(webhook)
    if parts.scheme != "https" or not parts.netloc:
        raise RuntimeError("DEMAND_TEAMS_WEBHOOK_URL must be a valid HTTPS URL")

    sent = 0
    # Select-for-update prevents concurrent workers from claiming the same release.
    # A network timeout can still cause at-least-once delivery.
    for item in DemandReleaseAlert.objects.filter(status="pending", attempts__lt=MAX_ATTEMPTS).order_by("first_seen_at")[:25]:
        with transaction.atomic():
            locked = DemandReleaseAlert.objects.select_for_update().get(pk=item.pk)
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
                locked.last_error = str(exc)[:2000]
                logger.warning("Demand Teams release %s delivery failed: %s", locked.release_key, type(exc).__name__)
            locked.attempts += 1
            if locked.attempts >= MAX_ATTEMPTS and locked.status != "sent":
                locked.status = "error"
            locked.save(update_fields=["status", "attempts", "last_error", "sent_at"])
    return {"sent": sent}
