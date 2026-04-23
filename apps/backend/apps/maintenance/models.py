from django.db import models
from django.conf import settings


class CorrectiveAction(models.Model):

    class Priority(models.TextChoices):
        HIGH   = "high",   "Alta"
        MEDIUM = "medium", "Media"
        LOW    = "low",    "Baja"

    class Status(models.TextChoices):
        OPEN        = "open",        "Open"
        IN_PROGRESS = "in_progress", "In Progress"
        CLOSED      = "closed",      "Closed"

    title             = models.CharField(max_length=255)
    description       = models.TextField(blank=True, default="")
    root_cause        = models.TextField(blank=True, default="")
    corrective_action = models.TextField(blank=True, default="")
    notes             = models.TextField(blank=True, default="")

    equipment_id    = models.CharField(max_length=100, blank=True, default="")
    equipment_desc  = models.CharField(max_length=255, blank=True, default="")
    equipment_group = models.CharField(max_length=255, blank=True, default="")

    priority = models.CharField(max_length=10,  choices=Priority.choices, default=Priority.MEDIUM)
    status   = models.CharField(max_length=15,  choices=Status.choices,   default=Status.OPEN)
    due_date = models.DateField(null=True, blank=True)

    assigned_to = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        null=True, blank=True,
        on_delete=models.SET_NULL,
        related_name="assigned_corrective_actions",
    )
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.PROTECT,
        related_name="created_corrective_actions",
    )

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "maintenance_corrective_action"
        ordering = ["-created_at"]

    def __str__(self):
        return f"[{self.priority.upper()}] {self.title}"