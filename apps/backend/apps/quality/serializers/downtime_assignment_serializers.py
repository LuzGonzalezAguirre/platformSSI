# apps/quality/serializers/downtime_assignment_serializers.py
from rest_framework import serializers


class DowntimeResolvedValueSerializer(serializers.Serializer):
    """Valor efectivo de un nivel: quién es, de dónde salió y si es heredado."""
    inspector_user_id = serializers.IntegerField(allow_null=True)
    inspector_name = serializers.CharField(allow_null=True, allow_blank=True)
    source = serializers.CharField(allow_null=True)
    inherited_from = serializers.CharField(allow_null=True)


class DowntimeAssignmentWorkcenterNodeSerializer(DowntimeResolvedValueSerializer):
    workcenter_id = serializers.IntegerField()
    workcenter_name = serializers.CharField()


class DowntimeAssignmentScopeNodeSerializer(DowntimeResolvedValueSerializer):
    group_key = serializers.CharField()
    subgroup_key = serializers.CharField(allow_blank=True)
    label = serializers.CharField()
    workcenters = DowntimeAssignmentWorkcenterNodeSerializer(many=True)


class DowntimeAssignmentGroupNodeSerializer(serializers.Serializer):
    group_key = serializers.CharField()
    label = serializers.CharField()
    workcenter_count = serializers.IntegerField()
    subgroups = DowntimeAssignmentScopeNodeSerializer(many=True)


class DowntimeGroupAssignmentWriteSerializer(serializers.Serializer):
    group_key = serializers.CharField()
    subgroup_key = serializers.CharField(required=False, allow_blank=True, default="")
    inspector_user_id = serializers.IntegerField(required=False, allow_null=True)
    inspector_name = serializers.CharField(required=False, allow_null=True, allow_blank=True)


class DowntimeOverrideWriteSerializer(serializers.Serializer):
    workcenter_id = serializers.IntegerField()
    inspector_user_id = serializers.IntegerField(required=False, allow_null=True)
    inspector_name = serializers.CharField(required=False, allow_null=True, allow_blank=True)


class DowntimeAssignmentsBulkWriteSerializer(serializers.Serializer):
    date = serializers.DateField()
    groups = DowntimeGroupAssignmentWriteSerializer(many=True, required=False)
    overrides = DowntimeOverrideWriteSerializer(many=True, required=False)

    def validate(self, attrs):
        # Guarda contra un frontend viejo cacheado en el navegador de planta:
        # el contrato anterior mandaba {date, assignments[]}. Si llega eso,
        # falla ruidosamente en vez de guardar cero filas en silencio.
        if "assignments" in self.initial_data:
            raise serializers.ValidationError(
                "Contrato obsoleto: usa 'groups' y 'overrides' en vez de "
                "'assignments'. Recarga el frontend (Ctrl+Shift+R)."
            )
        attrs.setdefault("groups", [])
        attrs.setdefault("overrides", [])
        return attrs


class DowntimeSummaryRowSerializer(serializers.Serializer):
    """Fila del resumen: (fecha, workcenter) → minutos + inspector."""
    date = serializers.CharField()
    workcenter = serializers.CharField()
    total_minutes = serializers.IntegerField()
    incident_count = serializers.IntegerField()
    inspector_name = serializers.CharField(allow_null=True)
    inspector_inherited_from = serializers.CharField(allow_null=True, required=False)

class DowntimeCustomerRowSerializer(serializers.Serializer):
    """Minutos de downtime agregados por cliente, para los KPIs."""
    customer = serializers.CharField()
    total_minutes = serializers.IntegerField()
    total_hours = serializers.FloatField()
    incident_count = serializers.IntegerField()
    workcenter_count = serializers.IntegerField()
    share_pct = serializers.FloatField()