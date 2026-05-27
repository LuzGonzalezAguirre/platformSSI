# apps/quality/serializers/failure_catalog_serializer.py
from rest_framework import serializers
from apps.quality.models.failure_catalog import FailureModeImage


class FailureModeImageSerializer(serializers.ModelSerializer):
    updated_by_name = serializers.SerializerMethodField()

    class Meta:
        model = FailureModeImage
        fields = [
            'id', 'inspection_point', 'failure_mode',
            'image_data', 'image_mime',
            'updated_by', 'updated_by_name', 'updated_at',
        ]
        read_only_fields = ['id', 'updated_by', 'updated_at']

    def get_updated_by_name(self, obj):
        if obj.updated_by:
            return obj.updated_by.get_full_name() or obj.updated_by.username
        return None
