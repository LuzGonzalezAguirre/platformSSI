# apps/quality/models/five_why.py
from django.db import models
from django.core.exceptions import ValidationError
from apps.identity.models import User


class FiveWhyAnalysis(models.Model):
    """
    Análisis 5 Why con 3 categorías: Made, Escape, Systemic.
    Permite múltiples análisis por problem.
    Validación: mínimo 3 Why's obligatorios (why1, why2, why3).
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
    
    # 5 Why's (mínimo 3 obligatorios)
    why1 = models.TextField(help_text="Obligatorio")
    why2 = models.TextField(help_text="Obligatorio")
    why3 = models.TextField(help_text="Obligatorio")
    why4 = models.TextField(blank=True, help_text="Opcional")
    why5 = models.TextField(blank=True, help_text="Opcional")
    
    corrective_action = models.TextField(
        blank=True,
        help_text="Acción correctiva derivada de este análisis"
    )
    
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
        """Validar que tenga mínimo 3 Why's"""
        return bool(self.why1 and self.why2 and self.why3)
    
    def clean(self):
        """Validación antes de guardar"""
        if not self.why1 or not self.why2 or not self.why3:
            raise ValidationError(
                "Mínimo 3 Why's son obligatorios (why1, why2, why3)"
            )


class RootCause(models.Model):
    """
    Root Cause vinculada a un análisis 5 Why.
    REGLA: Mínimo 3 root causes por cada FiveWhyAnalysis.
    La última (order=3) es la Root Cause final.
    """
    
    five_why = models.ForeignKey(
        FiveWhyAnalysis,
        on_delete=models.CASCADE,
        related_name='root_causes'
    )
    root_cause = models.TextField()
    order = models.IntegerField(
        help_text="Orden (1, 2, 3, ...). Mínimo 3 por análisis."
    )
    is_final = models.BooleanField(
        default=False,
        help_text="True para la última root cause (generalmente order=3)"
    )
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
        return f"{self.five_why} - RC {self.order}"
    
    def save(self, *args, **kwargs):
        # Auto-marcar como final si es la tercera (order=3)
        if self.order == 3:
            self.is_final = True
        super().save(*args, **kwargs)