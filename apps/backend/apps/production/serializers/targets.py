from rest_framework import serializers
from apps.production.models import BusinessUnit, WeeklyTarget, WeeklyWIP

DAY_FIELDS = ["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"]


class BusinessUnitSerializer(serializers.ModelSerializer):
    class Meta:
        model  = BusinessUnit
        fields = ["id", "code", "name", "is_active"]


class WeeklyTargetSerializer(serializers.ModelSerializer):
    business_unit_code = serializers.CharField(source="business_unit.code", read_only=True)
    business_unit_name = serializers.CharField(source="business_unit.name", read_only=True)

    class Meta:
        model  = WeeklyTarget
        fields = [
            "id", "business_unit_code", "business_unit_name",
            "week_start", "general_target",
            *DAY_FIELDS,
            "updated_at",
        ]


class WeeklyTargetWriteSerializer(serializers.Serializer):
    week_date      = serializers.DateField()
    bu_code        = serializers.CharField()
    general_target = serializers.IntegerField(min_value=0)
    monday    = serializers.IntegerField(min_value=0, required=False, allow_null=True)
    tuesday   = serializers.IntegerField(min_value=0, required=False, allow_null=True)
    wednesday = serializers.IntegerField(min_value=0, required=False, allow_null=True)
    thursday  = serializers.IntegerField(min_value=0, required=False, allow_null=True)
    friday    = serializers.IntegerField(min_value=0, required=False, allow_null=True)
    saturday  = serializers.IntegerField(min_value=0, required=False, allow_null=True)
    sunday    = serializers.IntegerField(min_value=0, required=False, allow_null=True)


class WeeklyWIPSerializer(serializers.ModelSerializer):
    business_unit_code = serializers.CharField(source="business_unit.code", read_only=True)

    class Meta:
        model  = WeeklyWIP
        fields = [
            "id", "business_unit_code", "week_start",
            "general_actual", "general_goal",
            "monday_actual", "monday_goal",
            "tuesday_actual", "tuesday_goal",
            "wednesday_actual", "wednesday_goal",
            "thursday_actual", "thursday_goal",
            "friday_actual", "friday_goal",
            "saturday_actual", "saturday_goal",
            "sunday_actual", "sunday_goal",
            "updated_at",
        ]


class WeeklyWIPWriteSerializer(serializers.Serializer):
    week_date      = serializers.DateField()
    bu_code        = serializers.CharField()
    general_actual = serializers.IntegerField(min_value=0, default=0)
    general_goal   = serializers.IntegerField(min_value=0, default=0)
    monday_actual    = serializers.IntegerField(min_value=0, required=False, allow_null=True)
    monday_goal      = serializers.IntegerField(min_value=0, required=False, allow_null=True)
    tuesday_actual   = serializers.IntegerField(min_value=0, required=False, allow_null=True)
    tuesday_goal     = serializers.IntegerField(min_value=0, required=False, allow_null=True)
    wednesday_actual = serializers.IntegerField(min_value=0, required=False, allow_null=True)
    wednesday_goal   = serializers.IntegerField(min_value=0, required=False, allow_null=True)
    thursday_actual  = serializers.IntegerField(min_value=0, required=False, allow_null=True)
    thursday_goal    = serializers.IntegerField(min_value=0, required=False, allow_null=True)
    friday_actual    = serializers.IntegerField(min_value=0, required=False, allow_null=True)
    friday_goal      = serializers.IntegerField(min_value=0, required=False, allow_null=True)
    saturday_actual  = serializers.IntegerField(min_value=0, required=False, allow_null=True)
    saturday_goal    = serializers.IntegerField(min_value=0, required=False, allow_null=True)
    sunday_actual    = serializers.IntegerField(min_value=0, required=False, allow_null=True)
    sunday_goal      = serializers.IntegerField(min_value=0, required=False, allow_null=True)