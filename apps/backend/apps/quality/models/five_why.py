# apps/quality/models/five_why.py
from django.db import models
from apps.identity.models import User


class FiveWhyAnalysis(models.Model):
    """
    Contenedor de análisis 5 Why por categoría (Made, Escape, Systemic).
    Los Why's ahora viven en cada fila RootCause (why1-5 en ese modelo).
    """

    WHY_CATEGORY_CHOICES = [
        ('made', 'Why Made (Creation)'),
        ('escape', 'Why Escape (Detection)'),
        ('systemic', 'Systemic'),
    ]

    problem = models.ForeignKey(
        'Problem',
        on_delete=models.CASCADE,
        related_name='five_why_analyses'
    )
    category = models.CharField(max_length=20, choices=WHY_CATEGORY_CHOICES)

    # Legacy why fields — now optional; rows live in RootCause.why1-5
    why1 = models.TextField(blank=True, default='')
    why2 = models.TextField(blank=True, default='')
    why3 = models.TextField(blank=True, default='')
    why4 = models.TextField(blank=True, default='')
    why5 = models.TextField(blank=True, default='')

    corrective_action = models.TextField(blank=True)

    created_at = models.DateTimeField(auto_now_add=True)
    created_by = models.ForeignKey(
        User,
        on_delete=models.PROTECT,
        related_name='five_why_analyses_created'
    )

    class Meta:
        db_table = 'quality_five_why_analysis'
        ordering = ['category', 'created_at']
        verbose_name = '5 Why Analysis'
        verbose_name_plural = '5 Why Analyses'
        indexes = [
            models.Index(fields=['problem', 'category']),
        ]

    def __str__(self):
        return f"{self.problem.problem_number or 'Draft'} - {self.get_category_display()}"

    def is_valid(self):
        """Valid if at least one root cause row has why1, why2, why3 filled."""
        return self.root_causes.filter(
            why1__gt='', why2__gt='', why3__gt=''
        ).exists()


class RootCause(models.Model):
    """
    Una fila en la tabla Five Why.
    Cada fila tiene su propia cadena de whys (why1-5).
    root_cause se auto-calcula como el último why no vacío.
    """

    five_why = models.ForeignKey(
        FiveWhyAnalysis,
        on_delete=models.CASCADE,
        related_name='root_causes'
    )
    root_cause = models.TextField(blank=True)
    order = models.IntegerField(help_text="Número de fila (1, 2, 3, …)")

    # Why chain — why1-3 required for validity, why4-5 optional
    why1 = models.TextField(blank=True, default='')
    why2 = models.TextField(blank=True, default='')
    why3 = models.TextField(blank=True, default='')
    why4 = models.TextField(blank=True, default='')
    why5 = models.TextField(blank=True, default='')

    # Corrective action per why level
    ca1 = models.TextField(blank=True, default='')
    ca2 = models.TextField(blank=True, default='')
    ca3 = models.TextField(blank=True, default='')
    ca4 = models.TextField(blank=True, default='')
    ca5 = models.TextField(blank=True, default='')

    is_final = models.BooleanField(default=True)

    created_at = models.DateTimeField(auto_now_add=True)
    created_by = models.ForeignKey(
        User,
        on_delete=models.PROTECT,
        related_name='root_causes_created'
    )

    class Meta:
        db_table = 'quality_root_cause'
        ordering = ['order']
        unique_together = ('five_why', 'order')
        verbose_name = 'Root Cause'
        verbose_name_plural = 'Root Causes'

    def __str__(self):
        return f"{self.five_why} - Row {self.order}"

    def save(self, *args, **kwargs):
        # Root cause = last non-empty corrective action in this line
        self.root_cause = self.ca5 or self.ca4 or self.ca3 or self.ca2 or self.ca1
        self.is_final = True
        super().save(*args, **kwargs)