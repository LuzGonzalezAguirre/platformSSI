from rest_framework import serializers


class DailyProductivitySerializer(serializers.Serializer):
    date               = serializers.DateField()
    turno              = serializers.CharField(allow_null=True)
    attendance_saved   = serializers.BooleanField()
    paid_hours         = serializers.DecimalField(max_digits=8, decimal_places=1, allow_null=True)
    earned_hours       = serializers.DecimalField(max_digits=8, decimal_places=1, allow_null=True)
    productivity_pct   = serializers.DecimalField(max_digits=6, decimal_places=1, allow_null=True)
    headcount_recorded = serializers.IntegerField()
    headcount_present  = serializers.IntegerField()
    headcount_absent   = serializers.IntegerField()
    notes              = serializers.CharField(allow_blank=True)
    recorded_at        = serializers.DateTimeField(allow_null=True)