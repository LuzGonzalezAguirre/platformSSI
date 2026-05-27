# apps/quality/models/actions.py
from django.db import models
from apps.identity.models import User


class ContainmentAction(models.Model):
    """
    Step 3b - Containment Actions.
    Acciones de contención inmediatas.
    """
    
    problem = models.ForeignKey(
        'Problem',
        on_delete=models.CASCADE,
        related_name='containment_actions'
    )
    add_date = models.DateField(auto_now_add=True)
    due_date = models.DateField(null=True, blank=True)
    completion_date = models.DateField(null=True, blank=True)
    ongoing = models.BooleanField(default=False)
    action = models.TextField()
    response = models.TextField(blank=True)
    responsible = models.ForeignKey(
        User,
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name='containment_actions_responsible'
    )
    
    class Meta:
        db_table = 'quality_containment_action'
        ordering = ['due_date']
        verbose_name = 'Containment Action'
        verbose_name_plural = 'Containment Actions'
    
    def __str__(self):
        return f"{self.problem} - Containment {self.id}"


class CorrectiveAction(models.Model):
    """
    Step 5 - Permanent Corrective Actions.
    VINCULADA A ROOT CAUSE (obligatorio).
    Mínimo 1 Corrective Action por Root Cause.
    """
    
    problem = models.ForeignKey(
        'Problem',
        on_delete=models.CASCADE,
        related_name='corrective_actions'
    )
    root_cause = models.ForeignKey(
        'RootCause',
        on_delete=models.CASCADE,
        related_name='corrective_actions',
        help_text="Root Cause que origina esta acción correctiva"
    )
    add_date = models.DateField(auto_now_add=True)
    due_date = models.DateField(null=True, blank=True)
    completion_date = models.DateField(null=True, blank=True)
    ongoing = models.BooleanField(default=False)
    action = models.TextField()
    response = models.TextField(blank=True)
    responsible = models.ForeignKey(
        User,
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name='corrective_actions_responsible'
    )
    
    class Meta:
        db_table = 'quality_corrective_action'
        ordering = ['due_date']
        verbose_name = 'Corrective Action'
        verbose_name_plural = 'Corrective Actions'
        indexes = [
            models.Index(fields=['problem', 'root_cause']),
        ]
    
    def __str__(self):
        return f"{self.problem} - Corrective {self.id}"


class VerificationAction(models.Model):
    """
    Step 6 - Verification Actions.
    Verificación de efectividad de las acciones correctivas.
    """
    
    problem = models.ForeignKey(
        'Problem',
        on_delete=models.CASCADE,
        related_name='verification_actions'
    )
    add_date = models.DateField(auto_now_add=True)
    due_date = models.DateField(null=True, blank=True)
    completion_date = models.DateField(null=True, blank=True)
    ongoing = models.BooleanField(default=False)
    action = models.TextField()
    response = models.TextField(blank=True)
    responsible = models.ForeignKey(
        User,
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name='verification_actions_responsible'
    )
    
    class Meta:
        db_table = 'quality_verification_action'
        ordering = ['due_date']
        verbose_name = 'Verification Action'
        verbose_name_plural = 'Verification Actions'
    
    def __str__(self):
        return f"{self.problem} - Verification {self.id}"


class PreventionAction(models.Model):
    """
    Step 7 - Control / Prevention Actions.
    Acciones para prevenir recurrencia.
    """
    
    problem = models.ForeignKey(
        'Problem',
        on_delete=models.CASCADE,
        related_name='prevention_actions'
    )
    add_date = models.DateField(auto_now_add=True)
    due_date = models.DateField(null=True, blank=True)
    completion_date = models.DateField(null=True, blank=True)
    ongoing = models.BooleanField(default=False)
    action = models.TextField()
    response = models.TextField(blank=True)
    responsible = models.ForeignKey(
        User,
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name='prevention_actions_responsible'
    )
    
    class Meta:
        db_table = 'quality_prevention_action'
        ordering = ['due_date']
        verbose_name = 'Prevention Action'
        verbose_name_plural = 'Prevention Actions'
    
    def __str__(self):
        return f"{self.problem} - Prevention {self.id}"