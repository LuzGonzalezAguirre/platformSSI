from django.db import models

from apps.identity.models import User


class ProblemControlSettings(models.Model):
    """Singleton configuration for Problem Control workflow defaults."""

    quality_manager = models.ForeignKey(
        User,
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name="problem_control_quality_manager_settings",
    )
    updated_by = models.ForeignKey(
        User,
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name="problem_control_settings_updates",
    )
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "quality_problem_control_settings"
        verbose_name = "Problem Control Settings"
        verbose_name_plural = "Problem Control Settings"

    @classmethod
    def load(cls):
        obj, _ = cls.objects.get_or_create(pk=1)
        return obj

    def save(self, *args, **kwargs):
        self.pk = 1
        super().save(*args, **kwargs)

    def delete(self, *args, **kwargs):
        return
