# apps/quality/serializers/downtime_assignment_serializers.py
from rest_framework import serializers


class DowntimeAssignmentRowSerializer(serializers.Serializer):
    """Fila de lectura: un workcenter + su inspector asignado ese día (o null)."""
    workcenter_id = serializers.IntegerField()
    workcenter_name = serializers.CharField()
    date = serializers.CharField()
    inspector_user_id = serializers.IntegerField(allow_null=True)
    inspector_name = serializers.CharField(allow_null=True, allow_blank=True)


class DowntimeAssignmentItemWriteSerializer(serializers.Serializer):
    workcenter_id = serializers.IntegerField()
    inspector_user_id = serializers.IntegerField(required=False, allow_null=True)
    inspector_name = serializers.CharField(required=False, allow_null=True, allow_blank=True)


class DowntimeAssignmentsBulkWriteSerializer(serializers.Serializer):
    date = serializers.DateField()
    assignments = DowntimeAssignmentItemWriteSerializer(many=True)


class DowntimeSummaryRowSerializer(serializers.Serializer):
    """Fila del resumen debajo de la tabla de logs: (fecha, workcenter) → minutos + inspector."""
    date = serializers.CharField()
    workcenter = serializers.CharField()
    total_minutes = serializers.IntegerField()
    incident_count = serializers.IntegerField()
    inspector_name = serializers.CharField(allow_null=True)