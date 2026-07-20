from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from apps.maintenance.services.dashboard_targets_service import DashboardTargetsService
from apps.maintenance.serializers.dashboard_targets import (
    DashboardTargetSerializer, DashboardTargetWriteSerializer,
)


class DashboardTargetsView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        targets = DashboardTargetsService.get_targets()
        return Response(DashboardTargetSerializer(targets, many=True).data)

    def put(self, request):
        serializer = DashboardTargetWriteSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        items = serializer.validated_data["items"]
        targets = DashboardTargetsService.update_targets(items, request.user)
        return Response(DashboardTargetSerializer(targets, many=True).data)
