# apps/quality/models/defect_type.py
from django.db import models


class DefectType(models.Model):
    """
    Catálogo configurable de tipos de defecto.
    Pre-populated con lista extensa.
    """
    code = models.CharField(max_length=100, unique=True, db_index=True)
    description = models.TextField(blank=True)
    is_active = models.BooleanField(default=True, db_index=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'quality_defect_type'
        ordering = ['code']
        verbose_name = 'Defect Type'
        verbose_name_plural = 'Defect Types'
        indexes = [
            models.Index(fields=['is_active', 'code']),
        ]

    def __str__(self):
        return self.code