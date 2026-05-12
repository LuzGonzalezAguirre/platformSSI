from rest_framework import serializers
from .models import QualityTarget

class QualityTargetSerializer(serializers.ModelSerializer):
    class Meta:
        model  = QualityTarget
        fields = [
            "id", "level", "bu", "workcenter_name",
            "yield_min_pct", "scrap_max_pct",
            "updated_by", "updated_at",
        ]
        read_only_fields = ["updated_by", "updated_at"]

"""
Problem Control Serializers for Django REST Framework.
"""
from rest_framework import serializers
from django.contrib.auth import get_user_model
from django.utils import timezone

from .models import Problem, Stage, AuditLog, SLASettings

User = get_user_model()


class UserBriefSerializer(serializers.ModelSerializer):
    """Minimal user info for nested serialization."""
    full_name = serializers.CharField(source='get_full_name', read_only=True)
    
    class Meta:
        model = User
        fields = ['id', 'username', 'full_name', 'email']


class StageSerializer(serializers.ModelSerializer):
    """Stage serializer with permissions."""
    can_edit = serializers.SerializerMethodField()
    requires_override = serializers.SerializerMethodField()
    assigned_to_name = serializers.CharField(
        source='assigned_to.get_full_name',
        read_only=True,
        allow_null=True
    )
    
    class Meta:
        model = Stage
        fields = [
            'id', 'stage_code', 'stage_name', 'status', 'data',
            'due_date', 'completed_at', 'is_overdue',
            'assigned_to', 'assigned_to_name',
            'override_requested', 'override_approved', 'override_reason',
            'can_edit', 'requires_override',
            'created_at', 'updated_at'
        ]
        read_only_fields = [
            'id', 'stage_code', 'stage_name', 'is_overdue',
            'created_at', 'updated_at'
        ]
    
    def get_can_edit(self, obj):
        """Check if user can edit this stage."""
        request = self.context.get('request')
        if not request or not request.user:
            return False
        
        # Cannot edit if overdue without override approval
        if obj.is_overdue and not obj.override_approved:
            return False
        
        # Check role permissions
        user_role = request.user.job_title.lower() if hasattr(request.user, 'job_title') else None
        
        PERMISSIONS_MATRIX = {
            'champion': ['D1', 'D2', 'D3', 'D4', 'D7'],
            'manager': ['D1', 'D2', 'D3', 'D4', 'D5', 'D6', 'D7', 'D8'],
            'quality': ['D5', 'D6', 'D8'],
            'supplier': ['D4'],
        }
        
        allowed_stages = PERMISSIONS_MATRIX.get(user_role, [])
        return obj.stage_code in allowed_stages
    
    def get_requires_override(self, obj):
        """Check if override is required to edit."""
        return obj.is_overdue and not obj.override_approved


class StageUpdateSerializer(serializers.Serializer):
    """Serializer for updating stage data."""
    data = serializers.JSONField(required=False)
    complete = serializers.BooleanField(default=False)


class ProblemListSerializer(serializers.ModelSerializer):
    """Lightweight serializer for problem list view."""
    created_by_name = serializers.CharField(
        source='created_by.get_full_name',
        read_only=True
    )
    champion_name = serializers.CharField(
        source='assigned_champion.get_full_name',
        read_only=True,
        allow_null=True
    )
    days_open = serializers.IntegerField(read_only=True)
    overdue_stages_count = serializers.SerializerMethodField()
    
    class Meta:
        model = Problem
        fields = [
            'id', 'problem_number', 'status', 'severity',
            'customer_name', 'part_number', 'description',
            'created_by', 'created_by_name',
            'assigned_champion', 'champion_name',
            'created_at', 'approved_at', 'closed_at',
            'days_open', 'overdue_stages_count'
        ]
        read_only_fields = ['id', 'problem_number', 'created_at']
    
    def get_overdue_stages_count(self, obj):
        """Count overdue stages."""
        if hasattr(obj, 'overdue_stages_count'):
            return obj.overdue_stages_count
        return obj.stages.filter(
            completed_at__isnull=True,
            due_date__lt=timezone.now()
        ).count()


class ProblemDetailSerializer(serializers.ModelSerializer):
    """Full problem details with stages and audit log."""
    created_by_detail = UserBriefSerializer(source='created_by', read_only=True)
    champion_detail = UserBriefSerializer(source='assigned_champion', read_only=True)
    quality_detail = UserBriefSerializer(source='assigned_quality', read_only=True)
    stages = StageSerializer(many=True, read_only=True)
    days_open = serializers.IntegerField(read_only=True)
    
    class Meta:
        model = Problem
        fields = [
            'id', 'problem_number', 'status', 'severity',
            'customer_name', 'part_number', 'description',
            'created_by', 'created_by_detail',
            'assigned_champion', 'champion_detail',
            'assigned_quality', 'quality_detail',
            'created_at', 'approved_at', 'closed_at', 'updated_at',
            'sla_d3_hours', 'sla_d4_days', 'sla_d5_days',
            'sla_d6_days', 'sla_d7_days',
            'days_open', 'stages'
        ]
        read_only_fields = [
            'id', 'problem_number', 'created_at', 'approved_at',
            'closed_at', 'updated_at', 'sla_d3_hours', 'sla_d4_days',
            'sla_d5_days', 'sla_d6_days', 'sla_d7_days'
        ]


class ProblemCreateSerializer(serializers.ModelSerializer):
    """Serializer for creating new problems."""
    
    class Meta:
        model = Problem
        fields = [
            'customer_name', 'part_number', 'description', 'severity',
            'assigned_champion', 'assigned_quality'
        ]
    
    def validate_severity(self, value):
        """Validate severity choice."""
        if value not in dict(Problem.Severity.choices):
            raise serializers.ValidationError("Invalid severity level")
        return value


class ProblemUpdateSerializer(serializers.ModelSerializer):
    """Serializer for updating draft problems."""
    
    class Meta:
        model = Problem
        fields = [
            'customer_name', 'part_number', 'description', 'severity',
            'assigned_champion', 'assigned_quality'
        ]


class ApprovalSerializer(serializers.Serializer):
    """Serializer for approval/rejection actions."""
    reason = serializers.CharField(
        required=False,
        allow_blank=True,
        help_text="Reason for rejection (required if rejecting)"
    )


class OverrideRequestSerializer(serializers.Serializer):
    """Serializer for requesting override on overdue stage."""
    reason = serializers.CharField(
        required=True,
        min_length=10,
        help_text="Reason for override request (min 10 chars)"
    )


class AuditLogSerializer(serializers.ModelSerializer):
    """Audit log entry serializer."""
    user_name = serializers.CharField(
        source='user.get_full_name',
        read_only=True,
        allow_null=True
    )
    
    class Meta:
        model = AuditLog
        fields = [
            'id', 'action', 'entity_type', 'changes',
            'user', 'user_name', 'ip_address',
            'created_at'
        ]
        read_only_fields = ['id', 'created_at']


class SLASettingsSerializer(serializers.ModelSerializer):
    """SLA settings serializer."""
    updated_by_name = serializers.CharField(
        source='updated_by.get_full_name',
        read_only=True,
        allow_null=True
    )
    
    class Meta:
        model = SLASettings
        fields = [
            'd3_hours', 'd4_days', 'd5_days', 'd6_days', 'd7_days',
            'updated_by', 'updated_by_name', 'updated_at'
        ]
        read_only_fields = ['updated_by', 'updated_at']
    
    def validate(self, data):
        """Validate all SLA values are positive."""
        for field in ['d3_hours', 'd4_days', 'd5_days', 'd6_days', 'd7_days']:
            if field in data and data[field] <= 0:
                raise serializers.ValidationError(
                    f"{field} must be positive"
                )
        return data