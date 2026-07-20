from django.db import models


class MaintenanceDashboardTarget(models.Model):
    COMPARISON_CHOICES = [
        ("gte", "≥ Target"),
        ("lte", "≤ Target"),
    ]

    metric_key   = models.CharField(max_length=50, unique=True)
    target_value = models.DecimalField(max_digits=10, decimal_places=2)
    comparison   = models.CharField(max_length=4, choices=COMPARISON_CHOICES)
    label_es     = models.CharField(max_length=100)
    label_en     = models.CharField(max_length=100)
    unit         = models.CharField(max_length=20, default="hrs")
    updated_by   = models.ForeignKey(
        "identity.User",
        null=True, blank=True,
        on_delete=models.SET_NULL,
        related_name="maintenance_targets_updated",
    )
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "maintenance_dashboard_target"
        ordering = ["metric_key"]
        verbose_name = "Maintenance Dashboard Target"

    def __str__(self):
        return f"{self.metric_key} {self.comparison} {self.target_value}"
