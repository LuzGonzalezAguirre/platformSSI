# apps/quality/models/problem.py
from django.db import models
from django.core.exceptions import ValidationError
from django.utils import timezone
from datetime import timedelta
from apps.identity.models import User


class Problem(models.Model):
    """
    Core Problem Control model (8D Report).
    Representa una queja de cliente o problema de calidad.
    """

    # ══════════════════════════════════════════════════════════════════════
    # CHOICES
    # ══════════════════════════════════════════════════════════════════════

    STATUS_CHOICES = [
        ('draft', 'Draft'),
        ('pending_approval', 'Pending Manager Approval'),
        ('approved', 'Approved'),
        ('closed', 'Closed'),
        ('rejected', 'Rejected'),
    ]

    CATEGORY_CHOICES = [
        ('', 'No Value Selected'),
        ('3rd_party_audit', '3rd Party Quality Systems Audit'),
        ('continuous_improvement', 'Continuous Improvement'),
        ('customer', 'Customer'),
        ('delivery', 'Delivery'),
        ('engineering', 'Engineering'),
        ('environmental', 'Environmental'),
        ('internal', 'Internal'),
        ('internal_audit', 'Internal Quality Audit'),
        ('preventive', 'Preventive'),
        ('safety', 'Safety'),
        ('supplier', 'Supplier'),
    ]

    PROBLEM_TYPE_CHOICES = [
        ('cost', 'Cost'),
        ('damaged', 'Damaged'),
        ('delivery', 'Delivery'),
        ('dimensional', 'Dimensional'),
        ('documentation', 'Documentation'),
        ('functional', 'Functional'),
        ('other', 'Other'),
        ('packaging', 'Packaging/Labeling'),
        ('preventive', 'Preventive'),
        ('product_improvement', 'Product/Process Improvement'),
    ]

    SHIFT_CHOICES = [
        ('', 'No Value Selected'),
        ('1st', '1st Shift'),
        ('2nd', '2nd Shift'),
        ('3rd', '3rd Shift'),
        ('weekend', 'Weekend'),
        ('a', 'A (Lunes-Jueves 6am-6pm)'),
        ('b', 'B (6pm-5am)'),
    ]

    SEVERITY_CONTEXT_CHOICES = [
        ('customer', 'Customer Note'),
        ('internal', 'Internal Note'),
        ('supplier', 'Supplier Note'),
        ('audit', 'Audit Note'),
    ]

    # ══════════════════════════════════════════════════════════════════════
    # IDENTIFICACIÓN
    # ══════════════════════════════════════════════════════════════════════

    problem_number = models.CharField(
        max_length=20,
        unique=True,
        null=True,
        blank=True,
        db_index=True,
        help_text="CA-WW-YY-XXXXX (generado al crear)"
    )

    status = models.CharField(
        max_length=20,
        choices=STATUS_CHOICES,
        default='draft',
        db_index=True
    )

    # ══════════════════════════════════════════════════════════════════════
    # CUSTOMER INFORMATION (desde Plex)
    # ══════════════════════════════════════════════════════════════════════

    customer_no = models.CharField(
        max_length=50,
        blank=True,
        help_text="Customer No from Plex"
    )
    customer_name = models.CharField(max_length=200, blank=True)
    customer_location = models.CharField(max_length=200, blank=True)
    customer_part_no = models.CharField(max_length=100, blank=True)
    customer_problem_no = models.CharField(max_length=100, blank=True)
    customer_contact_name = models.CharField(max_length=200, blank=True)
    customer_contact_fax = models.CharField(max_length=50, blank=True)
    customer_contact_phone = models.CharField(max_length=50, blank=True)
    customer_contact_email = models.EmailField(blank=True)

    # ══════════════════════════════════════════════════════════════════════
    # SUPPLIER INFORMATION (desde Plex)
    # ══════════════════════════════════════════════════════════════════════

    supplier_no = models.CharField(max_length=50, blank=True)
    supplier_name = models.CharField(max_length=200, blank=True)
    supplier_user_name = models.CharField(max_length=200, blank=True)
    supplier_email = models.EmailField(blank=True)
    supplier_phone = models.CharField(max_length=50, blank=True)

    # ══════════════════════════════════════════════════════════════════════
    # STEP 1 - DEFINE PROBLEM
    # ══════════════════════════════════════════════════════════════════════

    brief_description = models.CharField(max_length=500)
    full_description = models.TextField()
    category = models.CharField(
        max_length=50,
        choices=CATEGORY_CHOICES,
        blank=True,
        db_index=True
    )
    problem_type = models.CharField(
        max_length=50,
        choices=PROBLEM_TYPE_CHOICES,
        db_index=True
    )
    severity_level = models.ForeignKey(
        'SeverityLevel',
        on_delete=models.PROTECT,
        related_name='problems'
    )
    severity_context = models.CharField(
        max_length=20,
        choices=SEVERITY_CONTEXT_CHOICES,
        default='customer'
    )

    # ── Internal Part Information ─────────────────────────────────────────
    part_no = models.CharField(
        max_length=100,
        blank=True,
        help_text="Part No from Plex"
    )
    part_name = models.CharField(max_length=200, blank=True)
    department_code = models.CharField(
        max_length=50,
        blank=True,
        help_text="From Plex"
    )
    department_name = models.CharField(max_length=200, blank=True)
    workcenter_code = models.CharField(
        max_length=50,
        blank=True,
        help_text="From Plex"
    )
    workcenter_name = models.CharField(max_length=200, blank=True)
    shift = models.CharField(max_length=20, choices=SHIFT_CHOICES, blank=True)
    defect_type = models.ForeignKey(
        'DefectType',
        null=True,
        blank=True,
        on_delete=models.PROTECT,
        related_name='problems'
    )
    quantity_placed_on_hold = models.IntegerField(default=0)
    quantity_rejected = models.IntegerField(default=0)
    building = models.CharField(max_length=50, default='Tijuana')

    # ══════════════════════════════════════════════════════════════════════
    # STEP 2 - DEFINE TEAM
    # ══════════════════════════════════════════════════════════════════════

    champion = models.ForeignKey(
        User,
        on_delete=models.PROTECT,
        related_name='problems_championed',
        help_text="Usuario asignado (debe tener System Role Quality)"
    )
    team_members = models.ManyToManyField(
        User,
        related_name='problems_team_member',
        blank=True,
        help_text="Auto-completa Name/Position/Email desde User profile"
    )
    team_note = models.TextField(blank=True)

    # ══════════════════════════════════════════════════════════════════════
    # STEP 3a - INITIAL RESPONSE
    # ══════════════════════════════════════════════════════════════════════

    initial_response_due = models.DateTimeField(
        null=True,
        blank=True,
        help_text="Auto: created_at + 48hrs"
    )
    initial_response_date = models.DateField(
        null=True,
        blank=True,
        help_text="Fecha real de completado"
    )
    initial_response = models.TextField(blank=True)
    tracking_lot_batch_no = models.CharField(max_length=100, blank=True)
    tracking_build_ship_date = models.DateField(null=True, blank=True)
    d3_completed_at = models.DateTimeField(null=True, blank=True)

    # ══════════════════════════════════════════════════════════════════════
    # STEP 3b - CONTAINMENT (tabla separada)
    # ══════════════════════════════════════════════════════════════════════

    d4_completed_at = models.DateTimeField(null=True, blank=True)

    # ══════════════════════════════════════════════════════════════════════
    # STEP 4a - FIVE WHY (tabla separada)
    # ══════════════════════════════════════════════════════════════════════

    d5_completed_at = models.DateTimeField(null=True, blank=True)

    # ══════════════════════════════════════════════════════════════════════
    # STEP 4b - ROOT CAUSE (tabla separada)
    # ══════════════════════════════════════════════════════════════════════

    d6_completed_at = models.DateTimeField(null=True, blank=True)

    # ══════════════════════════════════════════════════════════════════════
    # STEP 5 - PERMANENT CORRECTIVE ACTION (tabla separada)
    # ══════════════════════════════════════════════════════════════════════

    d7_completed_at = models.DateTimeField(null=True, blank=True)

    # ══════════════════════════════════════════════════════════════════════
    # STEP 6 - VERIFICATION (tabla separada)
    # ══════════════════════════════════════════════════════════════════════

    d8_completed_at = models.DateTimeField(null=True, blank=True)

    # ══════════════════════════════════════════════════════════════════════
    # FMEA & CONTROL PLAN
    # ══════════════════════════════════════════════════════════════════════

    fmea_responsible = models.ForeignKey(
        User,
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name='problems_fmea_responsible'
    )
    fmea_update_required = models.BooleanField(default=False)
    fmea_due = models.DateField(null=True, blank=True)
    fmea_completed = models.DateField(null=True, blank=True)
    fmea_re_eval = models.DateField(null=True, blank=True)

    control_plan_responsible = models.ForeignKey(
        User,
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name='problems_cp_responsible'
    )
    control_plan_update_required = models.BooleanField(default=False)
    control_plan_due = models.DateField(null=True, blank=True)
    control_plan_completed = models.DateField(null=True, blank=True)
    control_plan_re_eval = models.DateField(null=True, blank=True)

    # ══════════════════════════════════════════════════════════════════════
    # SLA SNAPSHOTS (congelados al crear)
    # ══════════════════════════════════════════════════════════════════════

    sla_d3_hours = models.IntegerField(default=48)
    sla_d4_days = models.IntegerField(default=10)
    sla_d5_days = models.IntegerField(default=20)
    sla_d6_days = models.IntegerField(default=20)
    sla_d7_days = models.IntegerField(default=30)
    sla_d8_days = models.IntegerField(default=30)

    # ══════════════════════════════════════════════════════════════════════
    # APPROVAL
    # ══════════════════════════════════════════════════════════════════════

    approved_by = models.ForeignKey(
        User,
        null=True,
        blank=True,
        on_delete=models.PROTECT,
        related_name='problems_approved'
    )
    approved_at = models.DateTimeField(null=True, blank=True)
    approval_comments = models.TextField(blank=True)

    # ══════════════════════════════════════════════════════════════════════
    # OVERRIDE MECHANISM (después de 30 días globales)
    # ══════════════════════════════════════════════════════════════════════

    override_requested = models.BooleanField(default=False)
    override_approved_by = models.ForeignKey(
        User,
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name='problems_override_approved'
    )
    override_approved_at = models.DateTimeField(null=True, blank=True)
    override_reason = models.TextField(blank=True)

    # ══════════════════════════════════════════════════════════════════════
    # TIMESTAMPS & OWNERSHIP
    # ══════════════════════════════════════════════════════════════════════

    created_by = models.ForeignKey(
        User,
        on_delete=models.PROTECT,
        related_name='problems_created'
    )
    created_at = models.DateTimeField(auto_now_add=True, db_index=True)
    updated_at = models.DateTimeField(auto_now=True)
    closed_at = models.DateTimeField(null=True, blank=True)

    date_of_occurrence = models.DateTimeField(
        help_text="Cuando ocurrió el problema"
    )
    customer_issue_date = models.DateField(null=True, blank=True)
    target_close_date = models.DateField(
        null=True,
        blank=True,
        help_text="Auto: date_of_occurrence + 30 días"
    )
    actual_close_date = models.DateField(null=True, blank=True)

    # ══════════════════════════════════════════════════════════════════════
    # METADATA
    # ══════════════════════════════════════════════════════════════════════

    recurrence_count = models.IntegerField(
        default=0,
        help_text="Número de problems relacionados (recurrencias)"
    )

    class Meta:
        db_table = 'quality_problem'
        ordering = ['-created_at']
        verbose_name = 'Problem Control'
        verbose_name_plural = 'Problem Controls'
        indexes = [
            models.Index(fields=['status', '-created_at']),
            models.Index(fields=['champion', 'status']),
            models.Index(fields=['problem_number']),
            models.Index(fields=['category', 'status']),
            models.Index(fields=['severity_level', 'status']),
        ]

    def __str__(self):
        return self.problem_number or f"Draft-{self.id}"

    # ══════════════════════════════════════════════════════════════════════
    # HELPER METHODS
    # ══════════════════════════════════════════════════════════════════════

    def is_d3_overdue(self):
        """Check if D3 (Initial Response) is overdue"""
        if self.d3_completed_at:
            return False
        if not self.initial_response_due:
            return False
        return timezone.now() > self.initial_response_due

    def is_d4_overdue(self):
        """Check if D4 (Containment) is overdue"""
        if self.d4_completed_at:
            return False
        due = self.created_at + timedelta(days=self.sla_d4_days)
        return timezone.now() > due

    def is_d5_overdue(self):
        """Check if D5 (Five Why) is overdue"""
        if self.d5_completed_at:
            return False
        due = self.created_at + timedelta(days=self.sla_d5_days)
        return timezone.now() > due

    def is_d6_overdue(self):
        """Check if D6 (Root Cause) is overdue"""
        if self.d6_completed_at:
            return False
        due = self.created_at + timedelta(days=self.sla_d6_days)
        return timezone.now() > due

    def is_d7_overdue(self):
        """Check if D7 (Corrective Action) is overdue"""
        if self.d7_completed_at:
            return False
        due = self.created_at + timedelta(days=self.sla_d7_days)
        return timezone.now() > due

    def is_d8_overdue(self):
        """Check if D8 (Verification) is overdue"""
        if self.d8_completed_at:
            return False
        due = self.created_at + timedelta(days=self.sla_d8_days)
        return timezone.now() > due

    def is_globally_overdue(self):
        """
        Check if problem is globally overdue (>30 days desde creación).
        Requiere override del Manager para seguir editando.
        """
        return (timezone.now() - self.created_at).days > 30

    def can_close(self):
        """
        Validación antes de cerrar el problem.
        Returns: (bool, str) - (can_close, error_message)
        """
        errors = []

        # FMEA validation
        if self.fmea_update_required and not self.fmea_completed:
            errors.append("FMEA update required but not completed")

        # Control Plan validation
        if self.control_plan_update_required and not self.control_plan_completed:
            errors.append("Control Plan update required but not completed")

        # Five Why validation: cada categoría debe tener mínimo 3 Why's
        for five_why in self.five_why_analyses.all():
            if not five_why.is_valid():
                errors.append(
                    f"Five Why '{five_why.get_category_display()}' "
                    f"requires minimum 3 answers"
                )

        # Root Cause validation: cada 5Why debe tener mínimo 3 root causes
        for five_why in self.five_why_analyses.all():
            rc_count = five_why.root_causes.count()
            if rc_count < 3:
                errors.append(
                    f"Five Why '{five_why.get_category_display()}' "
                    f"requires minimum 3 root causes (has {rc_count})"
                )

        # Corrective Actions: cada root cause debe tener mínimo 1 corrective action
        for five_why in self.five_why_analyses.all():
            for root_cause in five_why.root_causes.all():
                ca_count = root_cause.corrective_actions.count()
                if ca_count < 1:
                    errors.append(
                        f"Root Cause '{root_cause.root_cause[:50]}...' "
                        f"requires at least 1 corrective action"
                    )

        if errors:
            return False, "; ".join(errors)

        return True, ""

    def save(self, *args, **kwargs):
        # Auto-calculate target_close_date
        if not self.target_close_date and self.date_of_occurrence:
            self.target_close_date = (
                self.date_of_occurrence + timedelta(days=30)
            ).date()

        # Auto-calculate initial_response_due
        if not self.initial_response_due:
            base = self.created_at or timezone.now()
            self.initial_response_due = base + timedelta(hours=self.sla_d3_hours)

        super().save(*args, **kwargs)