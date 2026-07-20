# apps/quality/models/fail_mode_translation.py
from django.db import models


class FailModeTranslation(models.Model):
    """
    Traducción local (Postgres) de un fail mode que vive en CCS (SQL Server,
    solo-lectura). fail_mode_code es una llave lógica al fail_code de
    ssi_FailModes, NO una FK real de base de datos — son sistemas distintos.
    """
    fail_mode_code = models.CharField(max_length=100)
    locale = models.CharField(max_length=10)
    name = models.CharField(max_length=255)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'quality_fail_mode_translations'
        unique_together = [['fail_mode_code', 'locale']]
        verbose_name = 'Fail Mode Translation'
        verbose_name_plural = 'Fail Mode Translations'
        indexes = [
            models.Index(fields=['fail_mode_code']),
        ]

    def __str__(self):
        return f"{self.fail_mode_code} [{self.locale}] = {self.name}"
