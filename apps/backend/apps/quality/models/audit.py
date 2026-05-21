# apps/quality/models/audit.py
from django.db import models
from apps.identity.models import User


class ProblemAudit(models.Model):
    """
    Audit trail completo para Problem Control.
    Registra todos los cambios (quién, cuándo, qué cambió).
    """
    
    problem = models.ForeignKey(
        'Problem',
        on_delete=models.CASCADE,
        related_name='audits'
    )
    user = models.ForeignKey(
        User,
        on_delete=models.PROTECT,
        related_name='problem_audits'
    )
    timestamp = models.DateTimeField(auto_now_add=True, db_index=True)
    action = models.CharField(
        max_length=50,
        help_text="created, updated, approved, rejected, closed, etc."
    )
    changes = models.JSONField(
        default=dict,
        help_text='{"field": "status", "old": "draft", "new": "approved"}'
    )
    ip_address = models.GenericIPAddressField(null=True, blank=True)
    
    class Meta:
        db_table = 'quality_problem_audit'
        ordering = ['-timestamp']
        verbose_name = 'Problem Audit'
        verbose_name_plural = 'Problem Audits'
        indexes = [
            models.Index(fields=['problem', '-timestamp']),
            models.Index(fields=['user', '-timestamp']),
        ]
    
    def __str__(self):
        return f"{self.problem} - {self.action} by {self.user}"