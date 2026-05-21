# apps/quality/models/holiday.py
from django.db import models


class Holiday(models.Model):
    """
    Días festivos configurables para cálculo de SLA.
    """
    date = models.DateField(unique=True, db_index=True)
    name = models.CharField(max_length=100)
    is_recurring = models.BooleanField(
        default=False,
        help_text="Si es recurrente cada año (ej: 1 de enero siempre)"
    )

    class Meta:
        db_table = 'quality_holiday'
        ordering = ['date']
        verbose_name = 'Holiday'
        verbose_name_plural = 'Holidays'

    def __str__(self):
        return f"{self.date.strftime('%Y-%m-%d')} - {self.name}"