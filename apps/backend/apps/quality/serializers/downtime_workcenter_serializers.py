# apps/quality/serializers/downtime_workcenter_serializers.py
from rest_framework import serializers

from apps.quality.models.downtime_workcenter import DowntimeWorkcenter


class DowntimeWorkcenterSerializer(serializers.ModelSerializer):
    class Meta:
        model = DowntimeWorkcenter
        fields = ["id", "name", "workcenter_group", "active", "updated_at"]