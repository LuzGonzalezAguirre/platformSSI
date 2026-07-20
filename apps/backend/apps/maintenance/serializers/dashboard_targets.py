from rest_framework import serializers
from apps.maintenance.models import MaintenanceDashboardTarget


class DashboardTargetSerializer(serializers.ModelSerializer):
    class Meta:
        model  = MaintenanceDashboardTarget
        fields = ["metric_key", "target_value", "comparison", "label_es", "label_en", "unit", "updated_at"]


class DashboardTargetWriteItemSerializer(serializers.Serializer):
    metric_key   = serializers.CharField()
    target_value = serializers.DecimalField(max_digits=10, decimal_places=2)


class DashboardTargetWriteSerializer(serializers.Serializer):
    items = DashboardTargetWriteItemSerializer(many=True)
