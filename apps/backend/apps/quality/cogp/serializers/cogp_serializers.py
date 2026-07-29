from rest_framework import serializers


class CogpBusinessUnitSummarySerializer(serializers.Serializer):
    scrap_cost = serializers.DecimalField(max_digits=14, decimal_places=2)
    extended_cost = serializers.DecimalField(max_digits=14, decimal_places=2)
    cogp_pct = serializers.DecimalField(
        max_digits=7, decimal_places=3, allow_null=True
    )


class CogpSummaryResponseSerializer(serializers.Serializer):
    start_date = serializers.DateField()
    end_date = serializers.DateField()
    by_business_unit = serializers.DictField(
        child=CogpBusinessUnitSummarySerializer()
    )
    unmapped_engineering = CogpBusinessUnitSummarySerializer(
        allow_null=True, required=False
    )