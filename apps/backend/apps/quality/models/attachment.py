# apps/quality/models/attachment.py
from django.db import models
from apps.identity.models import User


class ProblemAttachment(models.Model):
    """
    Attachments vinculados a un problem.
    Pueden ser globales o específicos por step.
    Formatos: JPG, PNG, PDF, Excel, Word, etc.
    """
    
    STEP_CHOICES = [
        ('general', 'General'),
        ('step1', 'Step 1 - Define Problem'),
        ('step3a', 'Step 3a - Initial Response'),
        ('step3b', 'Step 3b - Containment'),
        ('step5', 'Step 5 - Corrective Action'),
        ('step6', 'Step 6 - Verification'),
        ('step7', 'Step 7 - Prevention'),
    ]
    
    problem = models.ForeignKey(
        'Problem',
        on_delete=models.CASCADE,
        related_name='attachments'
    )
    step = models.CharField(
        max_length=20,
        choices=STEP_CHOICES,
        default='general',
        help_text="Step donde se subió el attachment"
    )
    file = models.FileField(
        upload_to='problem_attachments/%Y/%m/',
        help_text="Max 10MB por archivo"
    )
    filename = models.CharField(max_length=255)
    file_size = models.IntegerField(
        default=0,
        help_text="Size in bytes"
    )
    uploaded_by = models.ForeignKey(
        User,
        on_delete=models.PROTECT,
        related_name='problem_attachments_uploaded'
    )
    uploaded_at = models.DateTimeField(auto_now_add=True)
    description = models.CharField(max_length=200, blank=True)
    
    class Meta:
        db_table = 'quality_problem_attachment'
        ordering = ['uploaded_at']
        verbose_name = 'Problem Attachment'
        verbose_name_plural = 'Problem Attachments'
        indexes = [
            models.Index(fields=['problem', 'step']),
        ]
    
    def __str__(self):
        return f"{self.problem} - {self.filename}"
    
    def save(self, *args, **kwargs):
        # Auto-populate filename y file_size
        if self.file:
            self.filename = self.file.name
            self.file_size = self.file.size
        super().save(*args, **kwargs)