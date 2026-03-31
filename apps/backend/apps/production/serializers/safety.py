from rest_framework import serializers
from apps.production.models import SafetySettings, SafetyIncident


class SafetySettingsSerializer(serializers.ModelSerializer):
    class Meta:
        model  = SafetySettings
        fields = ["id", "plant", "days_without_incident", "last_incident_date", "updated_at"]
        read_only_fields = ["id", "days_without_incident", "updated_at"]


class SafetySettingsUpdateSerializer(serializers.Serializer):
    last_incident_date = serializers.DateField(required=False, allow_null=True)


class SafetyIncidentSerializer(serializers.ModelSerializer):
    reported_by_name = serializers.SerializerMethodField()

    class Meta:
        model  = SafetyIncident
        fields = [
            "id", "incident_date", "incident_type", "severity",
            "area", "description", "immediate_actions", "root_cause",
            "status", "reported_by_name", "created_at", "updated_at",
        ]
        read_only_fields = ["id", "reported_by_name", "created_at", "updated_at"]

    def get_reported_by_name(self, obj) -> str:
        return obj.reported_by.full_name if obj.reported_by else ""


class SafetyIncidentCreateSerializer(serializers.ModelSerializer):
    class Meta:
        model  = SafetyIncident
        fields = [
            "incident_date", "incident_type", "severity",
            "area", "description", "immediate_actions", "root_cause",
        ]


class SafetyIncidentUpdateSerializer(serializers.Serializer):
    status = serializers.ChoiceField(choices=SafetyIncident.Status.choices)