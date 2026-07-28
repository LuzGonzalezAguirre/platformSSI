# apps/quality/serializers/downtime_serializers.py
from rest_framework import serializers


class DowntimeLogsQuerySerializer(serializers.Serializer):
    PRESET_CHOICES = (
        ("today", "today"),
        ("yesterday", "yesterday"),
        ("this_week", "this_week"),
        ("this_month", "this_month"),
        ("custom", "custom"),
    )

    preset = serializers.ChoiceField(choices=PRESET_CHOICES)
    date_from = serializers.DateField(required=False)
    date_to = serializers.DateField(required=False)

    def validate(self, attrs):
        if attrs["preset"] == "custom":
            if "date_from" not in attrs or "date_to" not in attrs:
                raise serializers.ValidationError(
                    "date_from y date_to son obligatorios cuando preset=custom."
                )
        return attrs


class DowntimeLogSerializer(serializers.Serializer):
    log_date = serializers.CharField(allow_null=True)
    log_hours = serializers.FloatField(allow_null=True)
    status = serializers.CharField(allow_null=True)
    reason = serializers.CharField(allow_null=True)
    notes = serializers.CharField(allow_null=True, allow_blank=True)
    workcenter = serializers.CharField(allow_null=True)
    shift = serializers.CharField(allow_null=True)
    part_no = serializers.CharField(allow_null=True)
    operation_no = serializers.CharField(allow_null=True)
    operation_description = serializers.CharField(allow_null=True)
    job_no = serializers.CharField(allow_null=True)


class DowntimeTrendQuerySerializer(serializers.Serializer):
    GRANULARITY_CHOICES = (
        ("daily", "daily"),
        ("week", "week"),
        ("month", "month"),
    )
    granularity = serializers.ChoiceField(choices=GRANULARITY_CHOICES, default="daily")
    end_date = serializers.DateField(required=False)


class DowntimeTrendPointSerializer(serializers.Serializer):
    date = serializers.CharField()
    total_hours = serializers.FloatField()
    incident_count = serializers.IntegerField()