from django.db import models
from django.utils import timezone


COUNTER_RESETTING_TYPES = frozenset({
    "first_aid",
    "recordable",
    "lost_time",
    "covid_positive",
})


class SafetySettings(models.Model):
    plant = models.CharField(max_length=100, default="Tijuana", unique=True)
    last_incident_date = models.DateField(null=True, blank=True)
    baseline_date = models.DateField(
        null=True,
        blank=True,
        help_text="Ancla del conteo cuando aún no existe ningún incidente registrado.",
    )
    updated_at = models.DateTimeField(auto_now=True)
    updated_by = models.ForeignKey(
        "identity.User",
        null=True, blank=True,
        on_delete=models.SET_NULL,
        related_name="safety_settings_updated",
    )

    class Meta:
        db_table = "production_safety_settings"
        verbose_name = "Safety Settings"
        verbose_name_plural = "Safety Settings"

    @property
    def counter_anchor(self):
        return self.last_incident_date or self.baseline_date

    @property
    def days_without_incident(self) -> int:
        anchor = self.counter_anchor
        if anchor is None:
            return 0
        return max(0, (timezone.localdate() - anchor).days)

    def __str__(self):
        return f"Safety — {self.plant} ({self.days_without_incident} días)"


class SafetyIncident(models.Model):
    class Severity(models.TextChoices):
        LOW      = "low",      "Low"
        MEDIUM   = "medium",   "Medium"
        HIGH     = "high",     "High"
        CRITICAL = "critical", "Critical"

    class Status(models.TextChoices):
        OPEN        = "open",        "Open"
        IN_PROGRESS = "in_progress", "In Progress"
        CLOSED      = "closed",      "Closed"

    class IncidentType(models.TextChoices):
        NEAR_MISS       = "near_miss",       "Near Miss"
        FIRST_AID       = "first_aid",       "First Aid"
        RECORDABLE      = "recordable",      "Recordable"
        LOST_TIME       = "lost_time",       "Lost Time"
        COVID_POSITIVE  = "covid_positive",  "COVID Positive"
        PROPERTY_DAMAGE = "property_damage", "Property Damage"
        ENVIRONMENTAL   = "environmental",   "Environmental"

    incident_date     = models.DateField(verbose_name="Fecha del incidente", db_index=True)
    incident_type     = models.CharField(max_length=30, choices=IncidentType.choices, db_index=True)
    severity          = models.CharField(max_length=20, choices=Severity.choices)
    area              = models.CharField(max_length=100, blank=True)
    description       = models.TextField()
    immediate_actions = models.TextField(blank=True)
    root_cause        = models.CharField(max_length=100, blank=True)
    status            = models.CharField(
        max_length=20, choices=Status.choices, default=Status.OPEN, db_index=True
    )
    reported_by = models.ForeignKey(
        "identity.User",
        null=True, blank=True,
        on_delete=models.SET_NULL,
        related_name="reported_incidents",
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "production_safety_incident"
        ordering = ["-incident_date", "-created_at"]
        verbose_name = "Safety Incident"
        indexes = [
            models.Index(fields=["incident_date", "incident_type"]),
        ]

    @property
    def resets_counter(self) -> bool:
        return self.incident_type in COUNTER_RESETTING_TYPES

    def __str__(self):
        return f"{self.incident_type} — {self.incident_date} ({self.status})"


class SafetyCounterEvent(models.Model):
    """
    Bitácora inmutable de todo movimiento del contador de días sin incidente.
    Nunca se edita ni se borra — es la evidencia de auditoría.
    """

    class Source(models.TextChoices):
        MANUAL   = "manual",   "Ajuste manual"
        INCIDENT = "incident", "Incidente reportado"

    settings = models.ForeignKey(
        SafetySettings,
        on_delete=models.CASCADE,
        related_name="counter_events",
    )
    source = models.CharField(max_length=20, choices=Source.choices)
    incident = models.ForeignKey(
        SafetyIncident,
        null=True, blank=True,
        on_delete=models.SET_NULL,
        related_name="counter_events",
    )
    previous_incident_date = models.DateField(null=True, blank=True)
    new_incident_date      = models.DateField(null=True, blank=True)
    previous_days          = models.IntegerField()
    reason     = models.TextField(blank=True)
    created_by = models.ForeignKey(
        "identity.User",
        null=True, blank=True,
        on_delete=models.SET_NULL,
        related_name="safety_counter_events",
    )
    created_at = models.DateTimeField(auto_now_add=True, db_index=True)

    class Meta:
        db_table = "production_safety_counter_event"
        ordering = ["-created_at"]
        verbose_name = "Safety Counter Event"

    def __str__(self):
        return f"{self.source} — {self.previous_incident_date} → {self.new_incident_date}"