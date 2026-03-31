from django.db import models


class SafetySettings(models.Model):
    plant = models.CharField(max_length=100, default="Tijuana", unique=True)
    days_without_incident = models.IntegerField(default=0)
    last_incident_date = models.DateField(null=True, blank=True)
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
        NEAR_MISS        = "near_miss",        "Near Miss"
        FIRST_AID        = "first_aid",        "First Aid"
        RECORDABLE       = "recordable",       "Recordable"
        LOST_TIME        = "lost_time",        "Lost Time"
        PROPERTY_DAMAGE  = "property_damage",  "Property Damage"
        ENVIRONMENTAL    = "environmental",    "Environmental"

    incident_date  = models.DateField(verbose_name="Fecha del incidente")
    incident_type  = models.CharField(max_length=30, choices=IncidentType.choices)
    severity       = models.CharField(max_length=20, choices=Severity.choices)
    area           = models.CharField(max_length=100, blank=True)
    description    = models.TextField()
    immediate_actions = models.TextField(blank=True)
    root_cause     = models.CharField(max_length=100, blank=True)
    status         = models.CharField(max_length=20, choices=Status.choices, default=Status.OPEN)
    reported_by    = models.ForeignKey(
        "identity.User",
        null=True, blank=True,
        on_delete=models.SET_NULL,
        related_name="reported_incidents",
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table  = "production_safety_incident"
        ordering  = ["-incident_date", "-created_at"]
        verbose_name = "Safety Incident"

    def __str__(self):
        return f"{self.incident_type} — {self.incident_date} ({self.status})"