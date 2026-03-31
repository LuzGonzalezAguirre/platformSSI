from rest_framework import serializers
from apps.production.models import PlantEmployee, AttendanceRecord


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