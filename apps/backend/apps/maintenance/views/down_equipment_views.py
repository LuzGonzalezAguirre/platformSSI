from rest_framework import serializers
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.maintenance.services.down_equipment_service import DownEquipmentService
from apps.ssi_common.filters.choices import BU_CHOICES
from apps.ssi_common.filters.rbac import get_allowed_bu_for_user


class DownEquipmentFilterSerializer(serializers.Serializer):
    days = serializers.ChoiceField(choices=(7, 30, 90), default=30)
    bu = serializers.MultipleChoiceField(choices=BU_CHOICES, required=False)


class DownEquipmentDashboardView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        serializer = DownEquipmentFilterSerializer(data=request.query_params)
        serializer.is_valid(raise_exception=True)

        requested_bu = tuple(serializer.validated_data.get("bu", ()))
        allowed_bu = get_allowed_bu_for_user(request.user)
        effective_bu = (
            tuple(sorted(set(requested_bu) & set(allowed_bu)))
            if requested_bu else allowed_bu
        )

        data = DownEquipmentService.get_dashboard(
            days=int(serializer.validated_data["days"]),
            allowed_bu=effective_bu,
            include_unclassified=not requested_bu,
        )
        return Response(data)
