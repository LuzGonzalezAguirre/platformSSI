# apps/quality/views/downtime_workcenter_views.py
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated

from apps.quality.serializers import DowntimeWorkcenterSerializer
from apps.quality.services import downtime_workcenter_service


class DowntimeWorkcentersView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        qs = downtime_workcenter_service.list_active_workcenters()
        serializer = DowntimeWorkcenterSerializer(qs, many=True)
        return Response({"results": serializer.data})