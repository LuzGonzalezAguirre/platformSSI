from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from rest_framework import status
from .models import QualityTarget
from .serializers import QualityTargetSerializer
from .services.quality_service import QualityService
from apps.warehouse.services.plex_client import PlexProxyError

class ScrapDetailView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        start     = request.query_params.get("start_date")
        end       = request.query_params.get("end_date")
        use_shift = request.query_params.get("use_shift", "true").lower() == "true"

        if not start or not end:
            return Response({"detail": "start_date y end_date requeridos."}, status=400)
        try:
            data = QualityService().get_scrap_detail(start, end, use_shift)
            return Response(data)
        except PlexProxyError as e:
            return Response({"detail": str(e)}, status=502)


class QualityTargetView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        targets = QualityTarget.objects.all().order_by("level", "bu", "workcenter_name")
        return Response(QualityTargetSerializer(targets, many=True).data)

    def post(self, request):
        serializer = QualityTargetSerializer(data=request.data)
        if not serializer.is_valid():
            return Response(serializer.errors, status=400)
        serializer.save(updated_by=request.user)
        return Response(serializer.data, status=201)

    def put(self, request, pk: int):
        try:
            target = QualityTarget.objects.get(pk=pk)
        except QualityTarget.DoesNotExist:
            return Response({"detail": "No encontrado."}, status=404)
        serializer = QualityTargetSerializer(target, data=request.data, partial=True)
        if not serializer.is_valid():
            return Response(serializer.errors, status=400)
        serializer.save(updated_by=request.user)
        return Response(serializer.data)

    def delete(self, request, pk: int):
        try:
            QualityTarget.objects.get(pk=pk).delete()
        except QualityTarget.DoesNotExist:
            return Response({"detail": "No encontrado."}, status=404)
        return Response(status=204)