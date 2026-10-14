from datetime import date
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView
from apps.permissions.drf import module_permission
from apps.warehouse.services.plex_client import PlexProxyError
from apps.warehouse.services.delivery_performance import report

class DeliveryPerformanceView(APIView):
    permission_classes = [IsAuthenticated, module_permission("warehouse")]

    def get(self, request):
        try:
            year = int(request.query_params.get("year", date.today().year))
        except (ValueError, TypeError):
            return Response({"detail": "Invalid year"}, status=400)
        if not 2020 <= year <= date.today().year + 1:
            return Response({"detail": "Year out of range"}, status=400)
        try:
            return Response(report(year))
        except (PlexProxyError, ValueError) as exc:
            return Response({"detail": str(exc)}, status=502)
