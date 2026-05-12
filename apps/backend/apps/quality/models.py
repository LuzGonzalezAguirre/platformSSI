from django.db import models
from django.contrib.auth import get_user_model

User = get_user_model()

class QualityTarget(models.Model):
    LEVEL_BU          = "bu"
    LEVEL_WORKCENTER  = "workcenter"
    LEVEL_CHOICES     = [(LEVEL_BU, "BU"), (LEVEL_WORKCENTER, "Workcenter")]

    level             = models.CharField(max_length=20, choices=LEVEL_CHOICES)
    bu                = models.CharField(max_length=20, null=True, blank=True)
    workcenter_name   = models.CharField(max_length=100, null=True, blank=True)
    yield_min_pct     = models.DecimalField(max_digits=5, decimal_places=2, default=95.00)
    scrap_max_pct     = models.DecimalField(max_digits=5, decimal_places=2, default=2.00)
    updated_by        = models.ForeignKey(User, on_delete=models.SET_NULL, null=True)
    updated_at        = models.DateTimeField(auto_now=True)

    class Meta:
        db_table        = "quality_target"
        unique_together = [["level", "bu", "workcenter_name"]]

    def __str__(self):
        return f"{self.level} | {self.bu or ''} | {self.workcenter_name or ''}"
    
# ============================================
# PROBLEM CONTROL (8D) MODELS
# ============================================

import uuid
from django.db import models
from django.contrib.auth import get_user_model
from django.utils import timezone

User = get_user_model()


class Problem(models.Model):
    """
    Core Problem entity following 8D methodology.
    Workflow: Draft → Pending Approval → Approved → Closed
    """
    
    class Status(models.TextChoices):
        DRAFT = 'draft', 'Draft'
        PENDING_APPROVAL = 'pending_approval', 'Pending Approval'
        APPROVED = 'approved', 'Approved'
        CLOSED = 'closed', 'Closed'
        REJECTED = 'rejected', 'Rejected'
    
    class Severity(models.TextChoices):
        CRITICAL = 'critical', 'Critical'
        HIGH = 'high', 'High'
        MEDIUM = 'medium', 'Medium'
        LOW = 'low', 'Low'
    
    # Primary key
    id = models.UUIDField(
        primary_key=True,
        default=uuid.uuid4,
        editable=False
    )
    
    # Numbering (NULL until approved)
    problem_number = models.CharField(
        max_length=20,
        unique=True,
        null=True,
        blank=True,
        db_index=True,
        help_text="Format: CA-WW-YY-NNNN (generated on approval)"
    )
    
    # Status workflow
    status = models.CharField(
        max_length=20,
        choices=Status.choices,
        default=Status.DRAFT,
        db_index=True
    )
    
    # Business data
    customer_name = models.CharField(max_length=200)
    part_number = models.CharField(max_length=100, blank=True)
    description = models.TextField()
    severity = models.CharField(
        max_length=20,
        choices=Severity.choices,
        default=Severity.MEDIUM
    )
    
    # Ownership
    created_by = models.ForeignKey(
        User,
        on_delete=models.PROTECT,
        related_name='problems_created'
    )
    assigned_champion = models.ForeignKey(
        User,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='problems_championed'
    )
    assigned_quality = models.ForeignKey(
        User,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='problems_quality'
    )
    
    # Dates (all timezone-aware)
    created_at = models.DateTimeField(auto_now_add=True, db_index=True)
    approved_at = models.DateTimeField(null=True, blank=True)
    closed_at = models.DateTimeField(null=True, blank=True)
    updated_at = models.DateTimeField(auto_now=True)
    
    # SLA snapshot (frozen at creation - never changes)
    sla_d3_hours = models.IntegerField(default=48, help_text="Initial Response SLA")
    sla_d4_days = models.IntegerField(default=10, help_text="Containment SLA")
    sla_d5_days = models.IntegerField(default=20, help_text="Five Why SLA")
    sla_d6_days = models.IntegerField(default=20, help_text="Root Cause SLA")
    sla_d7_days = models.IntegerField(default=30, help_text="Corrective Action SLA")
    
    class Meta:
        db_table = 'problem_control_problem'
        ordering = ['-created_at']
        indexes = [
            models.Index(fields=['status', '-created_at']),
            models.Index(fields=['created_by', '-created_at']),
        ]
    
    def __str__(self):
        return self.problem_number or f"Draft-{str(self.id)[:8]}"
    
    @property
    def days_open(self):
        """Calculate days since creation."""
        end_date = self.closed_at or timezone.now()
        return (end_date - self.created_at).days
    
    @property
    def is_overdue(self):
        """Check if any stage is overdue."""
        return self.stages.filter(is_overdue=True).exists()


class ProblemSequence(models.Model):
    """
    Global sequence counter for problem numbering.
    Thread-safe via PostgreSQL FOR UPDATE lock.
    """
    id = models.IntegerField(primary_key=True, default=1)
    current_value = models.IntegerField(default=0)
    year = models.IntegerField()
    
    class Meta:
        db_table = 'problem_control_sequence'
    
    def __str__(self):
        return f"Sequence: {self.current_value}"


class Stage(models.Model):
    """
    Individual 8D stage (D1-D8).
    Stages run in parallel - no dependencies between them.
    """
    
    class Status(models.TextChoices):
        PENDING = 'pending', 'Pending'
        IN_PROGRESS = 'in_progress', 'In Progress'
        COMPLETED = 'completed', 'Completed'
    
    class StageCode(models.TextChoices):
        D1 = 'D1', 'D1 - Define Problem'
        D2 = 'D2', 'D2 - Define Team'
        D3 = 'D3', 'D3 - Initial Response'
        D4 = 'D4', 'D4 - Containment'
        D5 = 'D5', 'D5 - Five Why'
        D6 = 'D6', 'D6 - Root Cause'
        D7 = 'D7', 'D7 - Permanent Corrective Action'
        D8 = 'D8', 'D8 - Verification Control'
    
    # Primary key
    id = models.UUIDField(
        primary_key=True,
        default=uuid.uuid4,
        editable=False
    )
    
    # Foreign key to Problem
    problem = models.ForeignKey(
        Problem,
        on_delete=models.CASCADE,
        related_name='stages'
    )
    
    # Stage identification
    stage_code = models.CharField(
        max_length=3,
        choices=StageCode.choices
    )
    stage_name = models.CharField(max_length=100)
    
    # Stage status
    status = models.CharField(
        max_length=20,
        choices=Status.choices,
        default=Status.PENDING,
        db_index=True
    )
    
    # Stage data (flexible JSONB field)
    data = models.JSONField(default=dict, blank=True)
    
    # Ownership
    assigned_to = models.ForeignKey(
        User,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='stages_assigned'
    )
    completed_by = models.ForeignKey(
        User,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='stages_completed'
    )
    
    # Dates
    due_date = models.DateTimeField(
        null=True,
        blank=True,
        help_text="Calculated from problem.created_at + SLA"
    )
    completed_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    
    # Override mechanism
    override_requested = models.BooleanField(default=False)
    override_approved = models.BooleanField(default=False)
    override_reason = models.TextField(blank=True)
    override_approved_by = models.ForeignKey(
        User,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='overrides_approved'
    )
    override_approved_at = models.DateTimeField(null=True, blank=True)
    
    class Meta:
        db_table = 'problem_control_stage'
        ordering = ['stage_code']
        unique_together = [['problem', 'stage_code']]
        indexes = [
            models.Index(fields=['problem', 'status']),
            models.Index(fields=['status', 'due_date']),
        ]
    
    def __str__(self):
        return f"{self.problem} - {self.stage_code}"
    
    @property
    def is_overdue(self):
        """
        Check if stage is overdue.
        Overdue = not completed AND past due date.
        """
        if self.completed_at or not self.due_date:
            return False
        return timezone.now() > self.due_date
    
    @property
    def can_edit(self):
        """
        Can edit if:
        - Not overdue, OR
        - Override approved
        """
        if not self.is_overdue:
            return True
        return self.override_approved
    
    def complete(self, user):
        """Mark stage as completed."""
        self.status = self.Status.COMPLETED
        self.completed_at = timezone.now()
        self.completed_by = user
        self.save()
    
    def request_override(self, reason, user):
        """Request override for overdue stage."""
        self.override_requested = True
        self.override_reason = reason
        self.save()
        
        # Create audit log entry
        AuditLog.objects.create(
            stage=self,
            problem=self.problem,
            action=AuditLog.Action.OVERRIDE_REQUESTED,
            entity_type='stage',
            user=user,
            changes={'reason': reason}
        )
    
    def approve_override(self, user):
        """Approve override request (manager only)."""
        self.override_approved = True
        self.override_approved_by = user
        self.override_approved_at = timezone.now()
        self.save()
        
        # Create audit log entry
        AuditLog.objects.create(
            stage=self,
            problem=self.problem,
            action=AuditLog.Action.OVERRIDE_APPROVED,
            entity_type='stage',
            user=user,
            changes={'approved_by': user.get_full_name()}
        )


class AuditLog(models.Model):
    """
    Comprehensive audit trail for Problem Control system.
    Logs every create, update, approval, rejection, override action.
    """
    
    class Action(models.TextChoices):
        CREATED = 'created', 'Created'
        UPDATED = 'updated', 'Updated'
        APPROVED = 'approved', 'Approved'
        REJECTED = 'rejected', 'Rejected'
        CLOSED = 'closed', 'Closed'
        OVERRIDE_REQUESTED = 'override_requested', 'Override Requested'
        OVERRIDE_APPROVED = 'override_approved', 'Override Approved'
        OVERRIDE_REJECTED = 'override_rejected', 'Override Rejected'
        STAGE_COMPLETED = 'stage_completed', 'Stage Completed'
    
    # Primary key
    id = models.BigAutoField(primary_key=True)
    
    # References (nullable to support deletions)
    problem = models.ForeignKey(
        Problem,
        on_delete=models.CASCADE,
        null=True,
        blank=True,
        related_name='audit_logs'
    )
    stage = models.ForeignKey(
        Stage,
        on_delete=models.CASCADE,
        null=True,
        blank=True,
        related_name='audit_logs'
    )
    
    # Action details
    action = models.CharField(
        max_length=20,
        choices=Action.choices,
        db_index=True
    )
    entity_type = models.CharField(
        max_length=50,
        help_text="problem, stage, approval, override"
    )
    
    # Field-level changes (JSONB)
    changes = models.JSONField(default=dict, blank=True)
    
    # Context
    user = models.ForeignKey(
        User,
        on_delete=models.SET_NULL,
        null=True,
        related_name='problem_audit_logs'
    )
    ip_address = models.GenericIPAddressField(null=True, blank=True)
    user_agent = models.TextField(blank=True)
    
    # Timestamp
    created_at = models.DateTimeField(auto_now_add=True, db_index=True)
    
    class Meta:
        db_table = 'problem_control_audit_log'
        ordering = ['-created_at']
        indexes = [
            models.Index(fields=['problem', '-created_at']),
            models.Index(fields=['user', '-created_at']),
            models.Index(fields=['action', '-created_at']),
        ]
    
    def __str__(self):
        entity = self.problem or self.stage or "Unknown"
        return f"{self.action} on {entity} by {self.user}"
    
    @classmethod
    def log_change(cls, entity, action, user, changes=None, ip_address=None, user_agent=None):
        """
        Convenience method to create audit log entry.
        """
        log_data = {
            'action': action,
            'user': user,
            'changes': changes or {},
            'ip_address': ip_address,
            'user_agent': user_agent or ''
        }
        
        if isinstance(entity, Problem):
            log_data['problem'] = entity
            log_data['entity_type'] = 'problem'
        elif isinstance(entity, Stage):
            log_data['stage'] = entity
            log_data['problem'] = entity.problem
            log_data['entity_type'] = 'stage'
        
        return cls.objects.create(**log_data)


class SLASettings(models.Model):
    """
    Global SLA configuration for Problem Control.
    Only one instance exists (enforced by constraint).
    Changes apply to NEW problems only - existing problems keep frozen SLA.
    """
    
    # Singleton pattern
    id = models.IntegerField(primary_key=True, default=1)
    
    # SLA values (in hours/days)
    d3_hours = models.IntegerField(
        default=48,
        help_text="D3 Initial Response deadline (hours)"
    )
    d4_days = models.IntegerField(
        default=10,
        help_text="D4 Containment deadline (days)"
    )
    d5_days = models.IntegerField(
        default=20,
        help_text="D5 Five Why deadline (days)"
    )
    d6_days = models.IntegerField(
        default=20,
        help_text="D6 Root Cause deadline (days)"
    )
    d7_days = models.IntegerField(
        default=30,
        help_text="D7 Corrective Action deadline (days)"
    )
    
    # Audit
    updated_by = models.ForeignKey(
        User,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='sla_updates'
    )
    updated_at = models.DateTimeField(auto_now=True)
    
    class Meta:
        db_table = 'problem_control_sla_settings'
        constraints = [
            models.CheckConstraint(
                check=models.Q(id=1),
                name='sla_settings_singleton'
            )
        ]
    
    def __str__(self):
        return f"SLA Settings (D3:{self.d3_hours}h, D4:{self.d4_days}d)"
    
    def save(self, *args, **kwargs):
        """Enforce singleton - always id=1."""
        self.id = 1
        super().save(*args, **kwargs)
    
    @classmethod
    def get_current(cls):
        """Get or create singleton instance."""
        obj, created = cls.objects.get_or_create(id=1)
        return obj