"""Detect Plex Demand release changes without re-alerting existing baseline rows.

Distinct from the legacy 'new release' Teams queue. A first observation is
always seeded silently. Status uses Rel_Status, NEVER the Django queue status.
"""
import hashlib
import json
import logging
from datetime import timedelta
from decimal import Decimal, InvalidOperation
from urllib.parse import urlparse

import requests
from celery import shared_task
from django.conf import settings
from django.core.cache import cache
from django.db import transaction
from django.utils import timezone

from apps.warehouse.models import DemandReleaseSnapshot, DemandReleaseChangeAlert
from apps.warehouse.services.plex_client import PlexClient

logger = logging.getLogger(__name__)
MAX_ATTEMPTS = 5


def normalize_release(row):
    """Keep only stable fields, excluding shipment balances and EDI notes."""
    raw_qty = row.get("Rel_Qty")
    try:
        quantity = Decimal(str(raw_qty)) if raw_qty is not None else None
    except (InvalidOperation, TypeError, ValueError):
        raise ValueError("Invalid release quantity")
    date_string = str(row.get("Ship_Date") or "")[:10]
    from datetime import date
    ship_date = date.fromisoformat(date_string) if date_string else None
    status = str(row.get("Rel_Status") or "").strip()
    if not status:
        raise ValueError("Release without Rel_Status cannot be monitored safely")
    return {
        "release_key": int(row["Release_Key"]),
        "customer": str(row.get("Customer") or ""),
        "po": str(row.get("PO_Rel") or ""),
        "part": str(row.get("Part_No_Rev") or ""),
        "release_status": status,
        "quantity": quantity,
        "ship_date": ship_date,
    }


def release_differences(previous, current):
    """Return event types for field transitions, never for a first observation."""
    changed = []
    old_status = str(previous["release_status"]).strip().lower()
    new_status = str(current["release_status"]).strip().lower()
    if old_status != new_status:
        if new_status == "closed":
            changed.append("RELEASE_CLOSED")
        elif old_status == "closed" and new_status == "open":
            changed.append("RELEASE_REOPENED")
        else:
            changed.append("STATUS_CHANGED")
    if previous["quantity"] != current["quantity"]:
        changed.append("QUANTITY_CHANGED")
    if previous["ship_date"] != current["ship_date"]:
        changed.append("SHIP_DATE_CHANGED")
    return changed


def serializable_release(row):
    return {
        **row,
        "quantity": str(row["quantity"]) if row["quantity"] is not None else None,
        "ship_date": row["ship_date"].isoformat() if row["ship_date"] else None,
    }


def change_payload(before, after, event_types):
    titles = {
        "RELEASE_CLOSED": "Release cerrado",
        "RELEASE_REOPENED": "Release reabierto",
        "STATUS_CHANGED": "Estado de release modificado",
        "QUANTITY_CHANGED": "Cantidad de release modificada",
        "SHIP_DATE_CHANGED": "Fecha de embarque modificada",
    }
    primary = event_types[0]
    facts = [
        {"title": "Cliente", "value": after["customer"] or "—"},
        {"title": "PO", "value": after["po"] or "—"},
        {"title": "Parte", "value": after["part"] or "—"},
        {"title": "Release_Key", "value": str(after["release_key"])},
        {"title": "Estado", "value": f'{before["release_status"]} → {after["release_status"]}'},
        {"title": "Cantidad", "value": f'{before["quantity"]} → {after["quantity"]}'},
        {"title": "Ship Date", "value": f'{before["ship_date"]} → {after["ship_date"]}'},
        {"title": "Eventos", "value": ", ".join(event_types)},
    ]
    card = {
        "$schema": "http://adaptivecards.io/schemas/adaptive-card.json",
        "type": "AdaptiveCard",
        "version": "1.4",
        "msteams": {"width": "Full"},
        "body": [
            {"type": "TextBlock", "text": "WAREHOUSE · DEMAND", "weight": "Bolder", "size": "Small"},
            {"type": "TextBlock", "text": titles[primary], "weight": "Bolder", "size": "Large", "wrap": True},
            {"type": "FactSet", "facts": facts},
        ],
    }
    return {
        "tipo_alerta": primary,
        "tipos_de_cambio": event_types,
        "release_key": after["release_key"],
        "antes": before,
        "despues": after,
        "attachments": [{"contentType": "application/vnd.microsoft.card.adaptive", "content": card}],
    }


@shared_task(name="apps.warehouse.release_change_tasks.monitor_demand_release_changes")
def monitor_demand_release_changes():
    if not getattr(settings, "DEMAND_CHANGE_ALERTS_ENABLED", False):
        return {"status": "disabled"}

    lock_key = "warehouse:demand:change-monitor-lock"
    if not cache.add(lock_key, "1", timeout=600):
        return {"status": "busy"}
    try:
        today = timezone.localdate()
        # Past releases remain in scope, even after month rollover.
        start = today - timedelta(days=60)
        end = today + timedelta(days=90)
        rows = PlexClient().get_demand_status_snapshot(
            ship_date_from=start.isoformat(), ship_date_to=end.isoformat(),
        )
        if not rows:
            logger.warning("Demand change monitoring: empty Plex response; preserving previous snapshots")
            return {"status": "empty", "seeded": 0, "changed": 0}

        parsed = [normalize_release(row) for row in rows]
        if len({r["release_key"] for r in parsed}) != len(parsed):
            raise RuntimeError("Duplicate Release_Key returned by Plex; refusing ambiguous snapshot")
        created = changed = 0
        with transaction.atomic():
            for current in parsed:
                key = current["release_key"]
                snapshot, new = DemandReleaseSnapshot.objects.select_for_update().get_or_create(
                    release_key=key,
                    defaults={field: current[field] for field in (
                        "customer", "po", "part", "release_status", "quantity", "ship_date"
                    )},
                )
                if new:
                    created += 1
                    continue
                previous = {
                    field: getattr(snapshot, field) for field in (
                        "release_key", "customer", "po", "part", "release_status", "quantity", "ship_date"
                    )
                }
                diffs = release_differences(previous, current)
                if diffs:
                    old_data = serializable_release(previous)
                    new_data = serializable_release(current)
                    digest = hashlib.sha256(json.dumps(
                        {"old": old_data, "new": new_data},
                        sort_keys=True,
                    ).encode()).hexdigest()
                    _, event_created = DemandReleaseChangeAlert.objects.get_or_create(
                        event_key=digest,
                        defaults={
                            "release_key": key,
                            "event_type": diffs[0],
                            "payload": change_payload(old_data, new_data, diffs),
                        },
                    )
                    changed += int(event_created)
                for field in ("customer", "po", "part", "release_status", "quantity", "ship_date"):
                    setattr(snapshot, field, current[field])
                snapshot.save(update_fields=[
                    "customer", "po", "part", "release_status", "quantity", "ship_date", "last_observed_at"
                ])
        return {"status": "checked", "seeded": created, "changed": changed, "scanned": len(parsed)}
    finally:
        cache.delete(lock_key)


@shared_task(name="apps.warehouse.release_change_tasks.send_demand_release_change_alerts")
def send_demand_release_change_alerts():
    if not getattr(settings, "DEMAND_CHANGE_ALERTS_ENABLED", False):
        return {"status": "disabled"}
    webhook = str(getattr(settings, "DEMAND_TEAMS_WEBHOOK_URL", "") or "").strip()
    if not webhook:
        return {"status": "webhook_not_configured"}
    parsed = urlparse(webhook)
    if parsed.scheme != "https" or not parsed.netloc:
        raise RuntimeError("DEMAND_TEAMS_WEBHOOK_URL must be HTTPS")

    sent = 0
    for item in DemandReleaseChangeAlert.objects.filter(
        status="pending", attempts__lt=MAX_ATTEMPTS
    ).order_by("created_at")[:25]:
        with transaction.atomic():
            locked = DemandReleaseChangeAlert.objects.select_for_update().get(pk=item.pk)
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
                logger.warning("Demand change Teams release %s delivery failed: %s",
                               locked.release_key, type(exc).__name__)
            locked.attempts += 1
            if locked.attempts >= MAX_ATTEMPTS and locked.status != "sent":
                locked.status = "error"
            locked.save(update_fields=["status", "attempts", "last_error", "sent_at"])
    return {"sent": sent}
