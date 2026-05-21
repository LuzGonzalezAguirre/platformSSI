from django.db import models
from django.contrib.auth import get_user_model

User = get_user_model()

class QualityTarget(models.Model):
    LEVEL_BU          = "bu"
    LEVEL_WORKCENTER  = "workcenter"
    LEVEL_CHOICES     = [(LEVEL_BU, "BU"), (LEVEL_WORKCENTER, "Workcenter")]

    level             = models.CharField(max_length=20, choices=LEVEL_CHOICES)
    bu                = models.CharField(max_length=20, null=True, blank=True)
    workcenter_name   = models.CharField(max_length=100, null=True, blank=True)
    yield_min_pct     = models.DecimalField(max_digits=5, decimal_places=2, default=95.00)
    scrap_max_pct     = models.DecimalField(max_digits=5, decimal_places=2, default=2.00)
    updated_by        = models.ForeignKey(User, on_delete=models.SET_NULL, null=True)
    updated_at        = models.DateTimeField(auto_now=True)

    class Meta:
        db_table        = "quality_target"
        unique_together = [["level", "bu", "workcenter_name"]]

    def __str__(self):
        return f"{self.level} | {self.bu or ''} | {self.workcenter_name or ''}"