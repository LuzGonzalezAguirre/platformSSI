from rest_framework import serializers
from apps.audit.models import AuditLog
from apps.identity.models import User


class AuditLogSerializer(serializers.ModelSerializer):
    user_name = serializers.SerializerMethodField()
    user_employee_id = serializers.SerializerMethodField()

    class Meta:
        model = AuditLog
        fields = [
            "id",
            "user",
            "user_name",
            "user_employee_id",
            "action",
            "module",
            "resource",
            "resource_id",
            "description",
            "ip_address",
            "timestamp",
        ]

    def get_user_name(self, obj):
        return obj.user.full_name if obj.user else "—"

    def get_user_employee_id(self, obj):
        return obj.user.employee_id if obj.user else "—"


class UserActivitySerializer(serializers.ModelSerializer):
    full_name = serializers.SerializerMethodField()
    last_action_at = serializers.DateTimeField(read_only=True)
    total_actions = serializers.IntegerField(read_only=True)

    class Meta:
        model = User
        fields = [
            "id",
            "employee_id",
            "full_name",
            "plant",
            "is_active",
            "last_login_at",
            "last_action_at",
            "total_actions",
        ]

    def get_full_name(self, obj):
        return obj.full_name
