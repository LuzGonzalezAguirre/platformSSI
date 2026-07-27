# apps/quality/serializers/incoming_inspection_serializer.py
from rest_framework import serializers
from apps.quality.models import (
    IncomingContainerHistory,
    IncomingInspectionSLAConfig,
    IncomingRejectionComment,
)


class IncomingContainerHistorySerializer(serializers.ModelSerializer):
    class Meta:
        model = IncomingContainerHistory
        fields = [
            "id", "serial_no", "part_no", "operation_no", "change_date",
            "last_action", "location", "container_status", "defect_type",
            "note", "change_by",
        ]


class IncomingInspectionSLAConfigSerializer(serializers.ModelSerializer):
    class Meta:
        model = IncomingInspectionSLAConfig
        fields = ["id", "threshold_hours", "previous_value", "updated_by", "updated_at"]
        read_only_fields = ["id", "previous_value", "updated_by", "updated_at"]


class IncomingRejectionCommentSerializer(serializers.ModelSerializer):
    created_by_name = serializers.SerializerMethodField()

    class Meta:
        model = IncomingRejectionComment
        fields = ["id", "serial_no", "comment", "created_by", "created_by_name", "created_at"]
        read_only_fields = ["id", "created_by", "created_by_name", "created_at"]

    def get_created_by_name(self, obj):
        user = obj.created_by
        full_name = f"{user.first_name} {user.last_name}".strip()
        return full_name or user.username