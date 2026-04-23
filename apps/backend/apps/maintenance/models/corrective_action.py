from django.db import models
from django.conf import settings


class CorrectiveAction(models.Model):

    class Priority(models.TextChoices):
        HIGH   = "high",   "Alta"
        MEDIUM = "medium", "Media"
        LOW    = "low",    "Baja"

    class Status(models.TextChoices):
        OPEN               = "open",               "Open"
        IN_PROGRESS        = "in_progress",        "In Progress"
        PENDING_VALIDATION = "pending_validation",  "Pending Validation"
        ON_HOLD            = "on_hold",             "On Hold"
        CLOSED             = "closed",              "Closed"
        CANCELLED          = "cancelled",           "Cancelled"

    # Transiciones válidas
    VALID_TRANSITIONS = {
        "open":               {"in_progress", "cancelled"},
        "in_progress":        {"pending_validation", "on_hold", "cancelled"},
        "pending_validation": {"closed", "in_progress"},
        "on_hold":            {"in_progress", "cancelled"},
        "closed":             set(),
        "cancelled":          set(),
    }

    # ── Etapa 1: Registro ─────────────────────────────────────────────────────
    title          = models.CharField(max_length=255)
    description    = models.TextField(blank=True, default="")
    priority       = models.CharField(max_length=10, choices=Priority.choices, default=Priority.MEDIUM)
    equipment_id   = models.CharField(max_length=100, blank=True, default="")
    equipment_desc = models.CharField(max_length=255, blank=True, default="")
    equipment_group= models.CharField(max_length=255, blank=True, default="")

    # ── Etapa 2: Análisis ─────────────────────────────────────────────────────
    root_cause     = models.TextField(blank=True, default="")
    failure_type   = models.CharField(max_length=100, blank=True, default="")

    # ── Etapa 3: Ejecución ────────────────────────────────────────────────────
    corrective_action = models.TextField(blank=True, default="")
    assigned_to       = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        null=True, blank=True,
        on_delete=models.SET_NULL,
        related_name="assigned_corrective_actions",
    )
    due_date = models.DateField(null=True, blank=True)

    # ── Etapa 4: Cierre ───────────────────────────────────────────────────────
    close_notes  = models.TextField(blank=True, default="")
    closed_by    = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        null=True, blank=True,
        on_delete=models.SET_NULL,
        related_name="closed_corrective_actions",
    )
    closed_at = models.DateTimeField(null=True, blank=True)

    # ── Control ───────────────────────────────────────────────────────────────
    status     = models.CharField(max_length=25, choices=Status.choices, default=Status.OPEN)
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

    def can_transition_to(self, new_status: str) -> bool:
        return new_status in self.VALID_TRANSITIONS.get(self.status, set())

    @property
    def is_overdue(self) -> bool:
        from datetime import date
        return (
            self.due_date is not None
            and self.due_date < date.today()
            and self.status not in ("closed", "cancelled")
        )

    @property
    def cycle_time_days(self) -> int | None:
        if self.closed_at:
            return (self.closed_at.date() - self.created_at.date()).days
        return None


class CorrectiveActionComment(models.Model):
    action     = models.ForeignKey(
        CorrectiveAction,
        on_delete=models.CASCADE,
        related_name="comments",
    )
    text       = models.TextField()
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.PROTECT,
        related_name="ca_comments",
    )
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = "maintenance_ca_comment"
        ordering = ["created_at"]


class CorrectiveActionHistory(models.Model):
    action     = models.ForeignKey(
        CorrectiveAction,
        on_delete=models.CASCADE,
        related_name="history",
    )
    field      = models.CharField(max_length=50)   # "status", "assigned_to", "priority"
    old_value  = models.CharField(max_length=255, blank=True, default="")
    new_value  = models.CharField(max_length=255, blank=True, default="")
    changed_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.PROTECT,
        related_name="ca_history",
    )
    changed_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = "maintenance_ca_history"
        ordering = ["changed_at"]