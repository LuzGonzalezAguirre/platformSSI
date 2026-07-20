# apps/quality/serializers/incoming_inspection_serializer.py
from rest_framework import serializers
from apps.quality.models import IncomingContainerHistory, IncomingInspectionSLAConfig


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
