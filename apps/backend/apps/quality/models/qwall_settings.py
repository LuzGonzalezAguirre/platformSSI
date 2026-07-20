# apps/quality/models/qwall_settings.py
from django.db import models
from apps.identity.models import User


class QWallSettings(models.Model):
    """
    Configuración global de Q-Wall. Fila única (pk=1) — sin historial,
    sin versionado. Vive en Postgres; nunca se escribe hacia CCS.
    """
    pass_rate_target = models.DecimalField(max_digits=5, decimal_places=2, default=95.00)
    updated_by = models.ForeignKey(
        User,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='qwall_settings_updated',
    )
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'quality_qwall_settings'
        verbose_name = 'QWall Settings'

    @classmethod
    def get_solo(cls) -> "QWallSettings":
        obj, _ = cls.objects.get_or_create(pk=1)
        return obj

    def __str__(self):
        return f"QWall Settings (pass_rate_target={self.pass_rate_target})"
