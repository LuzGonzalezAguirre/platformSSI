from rest_framework import serializers
from apps.production.models import PlantEmployee, AttendanceRecord, CcsAttendanceRecord


class PlantEmployeeSerializer(serializers.ModelSerializer):
    user_name = serializers.SerializerMethodField()

    class Meta:
        model  = PlantEmployee
        fields = ["id", "name", "department", "turno", "user_name", "is_active", "created_at"]
        read_only_fields = ["id", "created_at"]

    def get_user_name(self, obj) -> str | None:
        return obj.user.full_name if obj.user else None


class PlantEmployeeCreateSerializer(serializers.ModelSerializer):
    class Meta:
        model  = PlantEmployee
        fields = ["name", "department", "turno"]


class PlantEmployeeUpdateSerializer(serializers.ModelSerializer):
    class Meta:
        model  = PlantEmployee
        fields = ["name", "department", "turno"]


class AttendanceRecordSerializer(serializers.ModelSerializer):
    employee_id   = serializers.IntegerField(source="employee.id", read_only=True)
    employee_name = serializers.CharField(source="employee.name", read_only=True)
    turno         = serializers.CharField(source="employee.turno", read_only=True)

    class Meta:
        model  = AttendanceRecord
        fields = [
            "id", "employee_id", "employee_name", "turno",
            "date", "status", "shift", "hours", "recorded_at",
        ]
        read_only_fields = ["id", "recorded_at"]


class AttendanceBulkItemSerializer(serializers.Serializer):
    employee_id = serializers.IntegerField()
    date        = serializers.DateField()
    status      = serializers.ChoiceField(choices=AttendanceRecord.Status.choices)
    shift       = serializers.ChoiceField(choices=AttendanceRecord.Shift.choices)
    hours       = serializers.DecimalField(max_digits=4, decimal_places=1)


class AttendanceBulkSerializer(serializers.Serializer):
    records = AttendanceBulkItemSerializer(many=True)


# ── Grilla diaria CCS (Postgres: CcsAttendanceRecord) ─────────────────────────
# Hasta hoy esta ruta aceptaba request.data crudo sin validar. Un status con
# typo entraba silencioso a la tabla.

class CcsAttendanceBulkItemSerializer(serializers.Serializer):
    employee_id = serializers.IntegerField()
    date        = serializers.DateField()
    turno       = serializers.ChoiceField(choices=PlantEmployee.Turno.choices)
    status      = serializers.ChoiceField(choices=CcsAttendanceRecord.Status.choices)
    shift       = serializers.ChoiceField(
        choices=AttendanceRecord.Shift.choices,
        required=False,
        default=AttendanceRecord.Shift.FULL,
    )
    hours       = serializers.DecimalField(
        max_digits=5, decimal_places=2, required=False, default=0,
    )


class CcsAttendanceBulkSerializer(serializers.Serializer):
    records = CcsAttendanceBulkItemSerializer(many=True, allow_empty=True)


class EarnedHoursSerializer(serializers.Serializer):
    date         = serializers.DateField(read_only=True)
    earned_hours = serializers.DecimalField(max_digits=7, decimal_places=1, read_only=True)
    notes        = serializers.CharField(read_only=True)
    recorded_at  = serializers.DateTimeField(read_only=True)


class EarnedHoursWriteSerializer(serializers.Serializer):
    date         = serializers.DateField()
    earned_hours = serializers.DecimalField(max_digits=7, decimal_places=1, min_value=0)
    notes        = serializers.CharField(required=False, allow_blank=True, default="")