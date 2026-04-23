from rest_framework import serializers
from apps.maintenance.models import CorrectiveAction, CorrectiveActionComment, CorrectiveActionHistory


class CommentSerializer(serializers.ModelSerializer):
    created_by_name = serializers.SerializerMethodField()

    class Meta:
        model  = CorrectiveActionComment
        fields = ["id", "text", "created_by", "created_by_name", "created_at"]
        read_only_fields = ["id", "created_by", "created_by_name", "created_at"]

    def get_created_by_name(self, obj):
        u = obj.created_by
        return f"{u.first_name} {u.last_name}".strip() if u else "—"


class HistorySerializer(serializers.ModelSerializer):
    changed_by_name = serializers.SerializerMethodField()

    class Meta:
        model  = CorrectiveActionHistory
        fields = ["id", "field", "old_value", "new_value", "changed_by_name", "changed_at"]

    def get_changed_by_name(self, obj):
        u = obj.changed_by
        return f"{u.first_name} {u.last_name}".strip() if u else "—"


class CorrectiveActionSerializer(serializers.ModelSerializer):
    created_by_name  = serializers.SerializerMethodField()
    assigned_to_name = serializers.SerializerMethodField()
    closed_by_name   = serializers.SerializerMethodField()
    is_overdue       = serializers.BooleanField(read_only=True)
    cycle_time_days  = serializers.IntegerField(read_only=True)
    comments         = CommentSerializer(many=True, read_only=True)
    history          = HistorySerializer(many=True, read_only=True)

    class Meta:
        model  = CorrectiveAction
        fields = [
            "id", "title", "description", "priority", "status",
            "equipment_id", "equipment_desc", "equipment_group",
            "root_cause", "failure_type",
            "corrective_action", "assigned_to", "assigned_to_name", "due_date",
            "close_notes", "closed_by", "closed_by_name", "closed_at",
            "created_by", "created_by_name",
            "is_overdue", "cycle_time_days",
            "created_at", "updated_at",
            "comments", "history",
        ]
        read_only_fields = [
            "id", "created_by", "created_by_name",
            "assigned_to_name", "closed_by_name", "closed_by", "closed_at",
            "is_overdue", "cycle_time_days",
            "created_at", "updated_at",
            "comments", "history",
        ]

    def get_created_by_name(self, obj):
        u = obj.created_by
        return f"{u.first_name} {u.last_name}".strip() if u else "—"

    def get_assigned_to_name(self, obj):
        u = obj.assigned_to
        return f"{u.first_name} {u.last_name}".strip() if u else "—"

    def get_closed_by_name(self, obj):
        u = obj.closed_by
        return f"{u.first_name} {u.last_name}".strip() if u else "—"


class CorrectiveActionListSerializer(serializers.ModelSerializer):
    """Serializer ligero para lista/Kanban — sin comments ni history."""
    created_by_name  = serializers.SerializerMethodField()
    assigned_to_name = serializers.SerializerMethodField()
    is_overdue       = serializers.BooleanField(read_only=True)
    cycle_time_days  = serializers.IntegerField(read_only=True)

    class Meta:
        model  = CorrectiveAction
        fields = [
            "id", "title", "priority", "status", "equipment_id", "equipment_desc",
            "assigned_to", "assigned_to_name", "due_date", "is_overdue",
            "cycle_time_days", "created_by_name", "created_at",
        ]

    def get_created_by_name(self, obj):
        u = obj.created_by
        return f"{u.first_name} {u.last_name}".strip() if u else "—"

    def get_assigned_to_name(self, obj):
        u = obj.assigned_to
        return f"{u.first_name} {u.last_name}".strip() if u else "—"