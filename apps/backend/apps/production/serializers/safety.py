from django.utils import timezone
from rest_framework import serializers

from apps.production.models import SafetySettings, SafetyIncident, SafetyCounterEvent


def _reject_future(value):
    if value and value > timezone.localdate():
        raise serializers.ValidationError("La fecha no puede ser futura.")
    return value


class SafetySettingsSerializer(serializers.ModelSerializer):
    days_without_incident = serializers.IntegerField(read_only=True)

    class Meta:
        model = SafetySettings
        fields = [
            "id", "plant", "days_without_incident",
            "last_incident_date", "baseline_date", "updated_at",
        ]
        read_only_fields = ["id", "plant", "days_without_incident", "updated_at"]


class SafetySettingsUpdateSerializer(serializers.Serializer):
    last_incident_date = serializers.DateField(required=False, allow_null=True)
    baseline_date      = serializers.DateField(required=False, allow_null=True)
    reason             = serializers.CharField(max_length=500, allow_blank=False)

    def validate_last_incident_date(self, value):
        return _reject_future(value)

    def validate_baseline_date(self, value):
        return _reject_future(value)

    def validate(self, attrs):
        if "last_incident_date" not in attrs and "baseline_date" not in attrs:
            raise serializers.ValidationError(
                "Debe enviarse last_incident_date o baseline_date."
            )
        return attrs


class SafetyIncidentSerializer(serializers.ModelSerializer):
    reported_by_name = serializers.SerializerMethodField()
    resets_counter   = serializers.BooleanField(read_only=True)

    class Meta:
        model = SafetyIncident
        fields = [
            "id", "incident_date", "incident_type", "severity",
            "area", "description", "immediate_actions", "root_cause",
            "status", "reported_by_name", "resets_counter",
            "created_at", "updated_at",
        ]
        read_only_fields = [
            "id", "reported_by_name", "resets_counter", "created_at", "updated_at",
        ]

    def get_reported_by_name(self, obj) -> str:
        return obj.reported_by.full_name if obj.reported_by else ""


class SafetyIncidentCreateSerializer(serializers.ModelSerializer):
    class Meta:
        model = SafetyIncident
        fields = [
            "incident_date", "incident_type", "severity",
            "area", "description", "immediate_actions", "root_cause",
        ]

    def validate_incident_date(self, value):
        return _reject_future(value)

    def validate_description(self, value):
        if not value.strip():
            raise serializers.ValidationError("La descripción es obligatoria.")
        return value.strip()


class SafetyIncidentUpdateSerializer(serializers.Serializer):
    status = serializers.ChoiceField(choices=SafetyIncident.Status.choices)


class SafetyCounterEventSerializer(serializers.ModelSerializer):
    created_by_name = serializers.SerializerMethodField()

    class Meta:
        model = SafetyCounterEvent
        fields = [
            "id", "source", "incident", "previous_incident_date",
            "new_incident_date", "previous_days", "reason",
            "created_by_name", "created_at",
        ]

    def get_created_by_name(self, obj) -> str:
        return obj.created_by.full_name if obj.created_by else "Sistema"