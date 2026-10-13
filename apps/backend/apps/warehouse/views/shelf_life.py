from datetime import date
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.permissions.drf import module_permission
from apps.warehouse.services.plex_client import PlexProxyError
from apps.warehouse.services.shelf_life import shelf_life_report


class ShelfLifeView(APIView):
    permission_classes = [IsAuthenticated, module_permission("warehouse")]

    def get(self, request):
        raw = request.query_params.get("as_of")
        try:
            as_of = date.fromisoformat(raw) if raw else date.today()
            horizon = int(request.query_params.get("horizon", "30"))
        except (ValueError, TypeError):
            return Response({"detail": "Invalid as_of or horizon"}, status=400)
        if horizon not in (7, 15, 30, 60, 90):
            return Response({"detail": "horizon must be 7, 15, 30, 60, or 90"}, status=400)
        try:
            return Response(shelf_life_report(as_of, horizon))
        except PlexProxyError as exc:
            return Response({"detail": str(exc)}, status=502)
