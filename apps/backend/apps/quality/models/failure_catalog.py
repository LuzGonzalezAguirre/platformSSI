# apps/quality/models/failure_catalog.py
from django.db import models
from apps.identity.models import User


class FailureModeImage(models.Model):
    """
    Almacena la imagen de referencia para un modo de falla específico.
    Los puntos de inspección y modos de falla se derivan del historial
    de inspecciones del qwall proxy — aquí solo se guarda la imagen en Postgres.
    """
    inspection_point = models.CharField(max_length=300)  # inspection_type del qwall
    failure_mode = models.CharField(max_length=300)       # modo de falla individual
    image_data = models.TextField(blank=True)             # base64 data URL guardado en Postgres
    image_mime = models.CharField(max_length=50, blank=True)
    updated_by = models.ForeignKey(
        User,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='failure_mode_images_updated',
    )
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'quality_failure_mode_image'
        unique_together = [['inspection_point', 'failure_mode']]
        verbose_name = 'Failure Mode Image'
        verbose_name_plural = 'Failure Mode Images'
        indexes = [
            models.Index(fields=['inspection_point']),
        ]

    def __str__(self):
        return f"{self.inspection_point} — {self.failure_mode}"
