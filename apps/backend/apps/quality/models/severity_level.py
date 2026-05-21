# apps/quality/models/severity_level.py
from django.db import models


class SeverityLevel(models.Model):
    """
    Severity levels 0-10 con 4 contextos de descripción.
    Pre-populated via fixture.
    """
    level = models.IntegerField(unique=True, db_index=True)
    customer_note = models.TextField()
    internal_note = models.TextField()
    supplier_note = models.TextField()
    audit_note = models.TextField()

    class Meta:
        db_table = 'quality_severity_level'
        ordering = ['level']
        verbose_name = 'Severity Level'
        verbose_name_plural = 'Severity Levels'

    def __str__(self):
        return f"Level {self.level}"