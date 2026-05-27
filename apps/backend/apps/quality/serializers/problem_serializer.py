# apps/quality/serializers/problem_serializer.py
from rest_framework import serializers
from apps.quality.models import (
    Problem,
    SeverityLevel,
    DefectType,
    FiveWhyAnalysis,
    RootCause,
    ContainmentAction,
    CorrectiveAction,
    VerificationAction,
    PreventionAction,
    ProblemAttachment,
    ProblemNote,
)
from apps.identity.models import User


# ═════════════════════════════════════════════════════════════════════════
# NESTED SERIALIZERS
# ═════════════════════════════════════════════════════════════════════════

class UserBasicSerializer(serializers.ModelSerializer):
    """Usuario básico para referencias (champion, responsible, etc.)"""
    class Meta:
        model = User
        fields = ['id', 'username', 'first_name', 'last_name', 'email']


class SeverityLevelSerializer(serializers.ModelSerializer):
    class Meta:
        model = SeverityLevel
        fields = '__all__'


class DefectTypeSerializer(serializers.ModelSerializer):
    class Meta:
        model = DefectType
        fields = ['id', 'code', 'description', 'is_active']


class RootCauseSerializer(serializers.ModelSerializer):
    created_by = UserBasicSerializer(read_only=True)

    class Meta:
        model = RootCause
        fields = [
            'id', 'five_why', 'order',
            'why1', 'why2', 'why3', 'why4', 'why5',
            'ca1', 'ca2', 'ca3', 'ca4', 'ca5',
            'root_cause', 'is_final',
            'created_at', 'created_by',
        ]
        read_only_fields = ['created_at', 'created_by', 'root_cause', 'is_final']


class FiveWhyAnalysisSerializer(serializers.ModelSerializer):
    root_causes = RootCauseSerializer(many=True, read_only=True)
    created_by = UserBasicSerializer(read_only=True)
    category_display = serializers.CharField(source='get_category_display', read_only=True)

    class Meta:
        model = FiveWhyAnalysis
        fields = [
            'id', 'problem', 'category', 'category_display',
            'corrective_action', 'root_causes',
            'created_at', 'created_by',
        ]
        read_only_fields = ['created_at', 'created_by']


class ContainmentActionSerializer(serializers.ModelSerializer):
    responsible = UserBasicSerializer(read_only=True)
    responsible_id = serializers.PrimaryKeyRelatedField(
        queryset=User.objects.all(),
        source='responsible',
        write_only=True,
        required=False,
        allow_null=True
    )

    class Meta:
        model = ContainmentAction
        fields = [
            'id', 'problem', 'add_date', 'due_date', 'completion_date',
            'ongoing', 'action', 'response',
            'responsible', 'responsible_id'
        ]
        read_only_fields = ['add_date']


class CorrectiveActionSerializer(serializers.ModelSerializer):
    responsible = UserBasicSerializer(read_only=True)
    responsible_id = serializers.PrimaryKeyRelatedField(
        queryset=User.objects.all(),
        source='responsible',
        write_only=True,
        required=False,
        allow_null=True
    )
    root_cause_id = serializers.PrimaryKeyRelatedField(
        queryset=RootCause.objects.all(),
        source='root_cause',
    )
    root_cause_description = serializers.CharField(source='root_cause.root_cause', read_only=True)
    due_date = serializers.DateField(required=False, allow_null=True)

    class Meta:
        model = CorrectiveAction
        fields = [
            'id', 'problem', 'root_cause_id', 'root_cause_description',
            'add_date', 'due_date', 'completion_date', 'ongoing',
            'action', 'response', 'responsible', 'responsible_id'
        ]
        read_only_fields = ['add_date']


class VerificationActionSerializer(serializers.ModelSerializer):
    responsible = UserBasicSerializer(read_only=True)
    responsible_id = serializers.PrimaryKeyRelatedField(
        queryset=User.objects.all(),
        source='responsible',
        write_only=True,
        required=False,
        allow_null=True
    )
    due_date = serializers.DateField(required=False, allow_null=True)

    class Meta:
        model = VerificationAction
        fields = [
            'id', 'problem', 'add_date', 'due_date', 'completion_date',
            'ongoing', 'action', 'response',
            'responsible', 'responsible_id'
        ]
        read_only_fields = ['add_date']


class PreventionActionSerializer(serializers.ModelSerializer):
    responsible = UserBasicSerializer(read_only=True)
    responsible_id = serializers.PrimaryKeyRelatedField(
        queryset=User.objects.all(),
        source='responsible',
        write_only=True,
        required=False,
        allow_null=True
    )
    due_date = serializers.DateField(required=False, allow_null=True)

    class Meta:
        model = PreventionAction
        fields = [
            'id', 'problem', 'add_date', 'due_date', 'completion_date',
            'ongoing', 'action', 'response',
            'responsible', 'responsible_id'
        ]
        read_only_fields = ['add_date']


class ProblemAttachmentSerializer(serializers.ModelSerializer):
    uploaded_by = UserBasicSerializer(read_only=True)
    step_display = serializers.CharField(source='get_step_display', read_only=True)

    class Meta:
        model = ProblemAttachment
        fields = [
            'id', 'step', 'step_display', 'file', 'filename',
            'file_size', 'uploaded_by', 'uploaded_at', 'description'
        ]
        read_only_fields = ['filename', 'file_size', 'uploaded_by', 'uploaded_at']


class ProblemNoteSerializer(serializers.ModelSerializer):
    created_by = UserBasicSerializer(read_only=True)
    step_display = serializers.CharField(source='get_step_display', read_only=True)

    class Meta:
        model = ProblemNote
        fields = ['id', 'problem', 'step', 'step_display', 'text', 'created_by', 'created_at', 'updated_at']
        read_only_fields = ['created_by', 'created_at', 'updated_at']


# ═════════════════════════════════════════════════════════════════════════
# MAIN PROBLEM SERIALIZERS
# ═════════════════════════════════════════════════════════════════════════

class ProblemListSerializer(serializers.ModelSerializer):
    """
    Serializer ligero para lista de problems.
    Campos mínimos para tabla de listado.
    """
    champion = UserBasicSerializer(read_only=True)
    severity_level_value = serializers.IntegerField(source='severity_level.level', read_only=True)
    status_display = serializers.CharField(source='get_status_display', read_only=True)
    category_display = serializers.CharField(source='get_category_display', read_only=True)
    is_overdue = serializers.SerializerMethodField()
    
    class Meta:
        model = Problem
        fields = [
            'id',
            'problem_number',
            'status',
            'status_display',
            'brief_description',
            'category',
            'category_display',
            'part_no',
            'customer_no',
            'customer_name',
            'supplier_no',
            'department_code',
            'champion',
            'severity_level_value',
            'building',
            'created_at',
            'target_close_date',
            'recurrence_count',
            'is_overdue',
        ]
    
    def get_is_overdue(self, obj):
        """Indicador si algún step está overdue"""
        return (
            obj.is_d3_overdue() or
            obj.is_d4_overdue() or
            obj.is_d5_overdue() or
            obj.is_d6_overdue() or
            obj.is_d7_overdue() or
            obj.is_d8_overdue()
        )


class ProblemDetailSerializer(serializers.ModelSerializer):
    """
    Serializer completo para detalle de problem.
    Incluye todas las relaciones nested.
    """
    # Related objects (read)
    champion = UserBasicSerializer(read_only=True)
    team_members = UserBasicSerializer(many=True, read_only=True)
    severity_level_data = SeverityLevelSerializer(source='severity_level', read_only=True)
    defect_type_data = DefectTypeSerializer(source='defect_type', read_only=True)
    created_by = UserBasicSerializer(read_only=True)
    approved_by = UserBasicSerializer(read_only=True)
    fmea_responsible = UserBasicSerializer(read_only=True)
    control_plan_responsible = UserBasicSerializer(read_only=True)
    
    # Write fields (IDs)
    champion_id = serializers.PrimaryKeyRelatedField(
        queryset=User.objects.all(),
        source='champion',
        write_only=True
    )
    team_member_ids = serializers.PrimaryKeyRelatedField(
        queryset=User.objects.all(),
        source='team_members',
        many=True,
        write_only=True,
        required=False
    )
    severity_level_id = serializers.PrimaryKeyRelatedField(
        queryset=SeverityLevel.objects.all(),
        source='severity_level',
        write_only=True
    )
    defect_type_id = serializers.PrimaryKeyRelatedField(
        queryset=DefectType.objects.all(),
        source='defect_type',
        write_only=True,
        required=False,
        allow_null=True
    )
    fmea_responsible_id = serializers.PrimaryKeyRelatedField(
        queryset=User.objects.all(),
        source='fmea_responsible',
        write_only=True,
        required=False,
        allow_null=True
    )
    control_plan_responsible_id = serializers.PrimaryKeyRelatedField(
        queryset=User.objects.all(),
        source='control_plan_responsible',
        write_only=True,
        required=False,
        allow_null=True
    )
    
    # Nested relations
    five_why_analyses = FiveWhyAnalysisSerializer(many=True, read_only=True)
    containment_actions = ContainmentActionSerializer(many=True, read_only=True)
    corrective_actions = CorrectiveActionSerializer(many=True, read_only=True)
    verification_actions = VerificationActionSerializer(many=True, read_only=True)
    prevention_actions = PreventionActionSerializer(many=True, read_only=True)
    attachments = ProblemAttachmentSerializer(many=True, read_only=True)
    
    # Display fields
    status_display = serializers.CharField(source='get_status_display', read_only=True)
    category_display = serializers.CharField(source='get_category_display', read_only=True)
    problem_type_display = serializers.CharField(source='get_problem_type_display', read_only=True)
    shift_display = serializers.CharField(source='get_shift_display', read_only=True)
    
    # Overdue flags
    is_d3_overdue = serializers.BooleanField(read_only=True)
    is_d4_overdue = serializers.BooleanField(read_only=True)
    is_d5_overdue = serializers.BooleanField(read_only=True)
    is_d6_overdue = serializers.BooleanField(read_only=True)
    is_d7_overdue = serializers.BooleanField(read_only=True)
    is_d8_overdue = serializers.BooleanField(read_only=True)
    is_globally_overdue = serializers.BooleanField(read_only=True)
    
    class Meta:
        model = Problem
        fields = '__all__'
        read_only_fields = [
            'problem_number',
            'created_at',
            'updated_at',
            'created_by',
            'approved_by',
            'approved_at',
            'closed_at',
            'initial_response_due',
            'target_close_date',
        ]


class ProblemCreateSerializer(serializers.ModelSerializer):
    """
    Serializer para crear problems (Draft).
    Solo campos requeridos en Step 1 + opcionales.
    """
    champion_id = serializers.PrimaryKeyRelatedField(
        queryset=User.objects.all(),
        source='champion',
        write_only=True
    )
    severity_level_id = serializers.PrimaryKeyRelatedField(
        queryset=SeverityLevel.objects.all(),
        source='severity_level',
        write_only=True
    )
    defect_type_id = serializers.PrimaryKeyRelatedField(
        queryset=DefectType.objects.all(),
        source='defect_type',
        write_only=True,
        required=False,
        allow_null=True
    )
    team_member_ids = serializers.ListField(
        child=serializers.IntegerField(),
        required=False,
        write_only=True
    )

    class Meta:
        model = Problem
        fields = [
            # Step 1 required
            'brief_description',
            'full_description',
            'problem_type',
            'severity_level_id',
            'champion_id',
            'date_of_occurrence',
            
            # Step 1 optional
            'category',
            'severity_context',
            'customer_no',
            'customer_name',
            'customer_part_no',
            'customer_problem_no',
            'supplier_no',
            'supplier_name',
            'part_no',
            'part_name',
            'department_code',
            'workcenter_code',
            'shift',
            'defect_type_id',
            'quantity_placed_on_hold',
            'quantity_rejected',
            
            # Step 2
            'team_member_ids',  # ← AGREGAR
        ]
    
    def create(self, validated_data):
        # Extraer team_member_ids antes de crear
        team_member_ids = validated_data.pop('team_member_ids', [])
        
        # Crear el problem
        problem = super().create(validated_data)
        
        # Asignar team members
        if team_member_ids:
            from apps.identity.models import User
            team_members = User.objects.filter(id__in=team_member_ids)
            problem.team_members.set(team_members)
        
        return problem
    
# apps/quality/serializers/problem_serializer.py

class ProblemUpdateSerializer(serializers.ModelSerializer):
    """
    Serializer para actualizar problems.
    """
    team_member_ids = serializers.ListField(
        child=serializers.IntegerField(),
        required=False,
        write_only=True
    )
    
    # ... resto de fields igual
    
    def update(self, instance, validated_data):
        # Extraer team_member_ids antes de actualizar
        team_member_ids = validated_data.pop('team_member_ids', None)
        
        # Actualizar campos del problem
        for attr, value in validated_data.items():
            setattr(instance, attr, value)
        instance.save()
        
        # Actualizar team members si se proporcionaron
        if team_member_ids is not None:
            from apps.identity.models import User
            team_members = User.objects.filter(id__in=team_member_ids)
            instance.team_members.set(team_members)
        
        return instance