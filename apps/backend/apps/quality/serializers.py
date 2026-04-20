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