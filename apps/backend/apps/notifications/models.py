from django.conf import settings
from django.db import models
from django.utils import timezone


class Notification(models.Model):
    recipient = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="notifications",
    )
    actor = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name="notifications_created",
    )
    notification_type = models.CharField(max_length=60)
    title = models.CharField(max_length=180)
    message = models.TextField()
    module = models.CharField(max_length=60, db_index=True)
    entity_type = models.CharField(max_length=60, blank=True)
    entity_id = models.PositiveBigIntegerField(null=True, blank=True)
    action_url = models.CharField(max_length=300, blank=True)
    metadata = models.JSONField(default=dict, blank=True)
    event_key = models.CharField(max_length=220, unique=True)
    is_task = models.BooleanField(default=False, db_index=True)
    read_at = models.DateTimeField(null=True, blank=True, db_index=True)
    resolved_at = models.DateTimeField(null=True, blank=True, db_index=True)
    created_at = models.DateTimeField(auto_now_add=True, db_index=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "core_notification"
        ordering = ["-created_at"]
        indexes = [
            models.Index(fields=["recipient", "read_at", "created_at"], name="core_notifi_recipie_8a2ab8_idx"),
            models.Index(fields=["recipient", "is_task", "resolved_at"], name="core_notifi_recipie_02a816_idx"),
        ]

    @property
    def is_pending(self):
        return self.is_task and self.resolved_at is None

    def mark_read(self):
        if self.read_at is None:
            self.read_at = timezone.now()
            self.save(update_fields=["read_at", "updated_at"])
