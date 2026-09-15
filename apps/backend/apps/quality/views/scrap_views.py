# apps/quality/views/scrap_views.py
from datetime import date

from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from apps.quality.services.quality_service import QualityService
from apps.warehouse.services.plex_client import PlexProxyError


class ScrapDetailView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        start = request.query_params.get("start_date")
        end = request.query_params.get("end_date")
        use_shift = request.query_params.get("use_shift", "true").lower() == "true"

        if not start or not end:
            return Response(
                {"detail": "start_date y end_date requeridos."},
                status=400
            )
        try:
            start_date = date.fromisoformat(start)
            end_date = date.fromisoformat(end)
        except ValueError:
            return Response({"detail": "Formato de fecha inválido; use YYYY-MM-DD."}, status=400)
        if end_date < start_date:
            return Response({"detail": "end_date debe ser mayor o igual a start_date."}, status=400)
        if (end_date - start_date).days >= 366:
            return Response({"detail": "El rango máximo permitido es 366 días."}, status=400)
        try:
            data = QualityService().get_scrap_detail(start, end, use_shift)
            return Response(data)
        except PlexProxyError as e:
            return Response({"detail": str(e)}, status=502)
