"""Local PostgreSQL outbox for read-only CCS Pack and Ship incident events."""
from django.db import models


class PackShipIncidentCursor(models.Model):
    """Last event_id durably and completely queued; baseline is silent."""
    source = models.CharField(max_length=48, primary_key=True, default="volvo")
    last_event_id = models.BigIntegerField(default=0)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "production_pack_ship_incident_cursor"


class PackShipIncidentAlert(models.Model):
    """An event is alerted once by event_id, even after task retries."""
    event_id = models.BigIntegerField(unique=True)
    container_code = models.CharField(max_length=32)
    rejection_type = models.CharField(max_length=100, blank=True, default="")
    payload = models.JSONField(default=dict)
    status = models.CharField(max_length=16, default="pending", db_index=True)
    attempts = models.PositiveSmallIntegerField(default=0)
    last_error = models.TextField(blank=True, default="")
    created_at = models.DateTimeField(auto_now_add=True)
    sent_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        db_table = "production_pack_ship_incident_alert"
        ordering = ["created_at"]
