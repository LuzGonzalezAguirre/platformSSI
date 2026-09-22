from django.db import models


class CogpSettings(models.Model):
    cost_target_pct = models.DecimalField(max_digits=5, decimal_places=2, default=2)
    pieces_target_pct = models.DecimalField(max_digits=5, decimal_places=2, default=10)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "quality_cogp_settings"

    @classmethod
    def get_solo(cls):
        obj, _ = cls.objects.get_or_create(pk=1)
        return obj
