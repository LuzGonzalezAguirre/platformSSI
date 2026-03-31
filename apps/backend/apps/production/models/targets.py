from django.db import models


class BusinessUnit(models.Model):
    code = models.CharField(max_length=20, unique=True, verbose_name="Código")
    name = models.CharField(max_length=100, verbose_name="Nombre")
    is_active = models.BooleanField(default=True)

    class Meta:
        db_table = "production_business_unit"
        ordering = ["name"]
        verbose_name = "Business Unit"
        verbose_name_plural = "Business Units"

    def __str__(self):
        return self.name


class WeeklyTarget(models.Model):
    business_unit = models.ForeignKey(
        BusinessUnit,
        on_delete=models.CASCADE,
        related_name="weekly_targets",
    )
    week_start = models.DateField(verbose_name="Inicio de semana (lunes)")
    general_target = models.IntegerField(default=0)
    monday    = models.IntegerField(null=True, blank=True)
    tuesday   = models.IntegerField(null=True, blank=True)
    wednesday = models.IntegerField(null=True, blank=True)
    thursday  = models.IntegerField(null=True, blank=True)
    friday    = models.IntegerField(null=True, blank=True)
    saturday  = models.IntegerField(null=True, blank=True)
    sunday    = models.IntegerField(null=True, blank=True)
    updated_at = models.DateTimeField(auto_now=True)
    updated_by = models.ForeignKey(
        "identity.User",
        null=True, blank=True,
        on_delete=models.SET_NULL,
        related_name="weekly_targets_updated",
    )

    class Meta:
        db_table = "production_weekly_target"
        unique_together = ("business_unit", "week_start")
        ordering = ["-week_start"]
        verbose_name = "Weekly Target"

    def get_day_target(self, day_name: str) -> int:
        value = getattr(self, day_name.lower(), None)
        return value if value is not None else self.general_target

    def __str__(self):
        return f"{self.business_unit.code} — {self.week_start}"


class WeeklyWIP(models.Model):
    business_unit = models.ForeignKey(
        BusinessUnit,
        on_delete=models.CASCADE,
        related_name="weekly_wips",
    )
    week_start     = models.DateField(verbose_name="Inicio de semana (lunes)")
    general_actual = models.IntegerField(default=0)
    general_goal   = models.IntegerField(default=0)
    monday_actual    = models.IntegerField(null=True, blank=True)
    monday_goal      = models.IntegerField(null=True, blank=True)
    tuesday_actual   = models.IntegerField(null=True, blank=True)
    tuesday_goal     = models.IntegerField(null=True, blank=True)
    wednesday_actual = models.IntegerField(null=True, blank=True)
    wednesday_goal   = models.IntegerField(null=True, blank=True)
    thursday_actual  = models.IntegerField(null=True, blank=True)
    thursday_goal    = models.IntegerField(null=True, blank=True)
    friday_actual    = models.IntegerField(null=True, blank=True)
    friday_goal      = models.IntegerField(null=True, blank=True)
    saturday_actual  = models.IntegerField(null=True, blank=True)
    saturday_goal    = models.IntegerField(null=True, blank=True)
    sunday_actual    = models.IntegerField(null=True, blank=True)
    sunday_goal      = models.IntegerField(null=True, blank=True)
    updated_at = models.DateTimeField(auto_now=True)
    updated_by = models.ForeignKey(
        "identity.User",
        null=True, blank=True,
        on_delete=models.SET_NULL,
        related_name="weekly_wips_updated",
    )

    class Meta:
        db_table = "production_weekly_wip"
        unique_together = ("business_unit", "week_start")
        ordering = ["-week_start"]
        verbose_name = "Weekly WIP"

    def get_day_value(self, day_name: str, metric: str) -> int:
        value = getattr(self, f"{day_name.lower()}_{metric}", None)
        return value if value is not None else getattr(self, f"general_{metric}", 0)

    def __str__(self):
        return f"{self.business_unit.code} WIP — {self.week_start}"