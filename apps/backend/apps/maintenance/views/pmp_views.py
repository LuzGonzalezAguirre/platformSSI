# apps/maintenance/views/pmp_views.py
from datetime import date

from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.maintenance.services.pmp_service import PmpService, PmpServiceError


class PmpCalendarView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        today = date.today()
        try:
            year  = int(request.query_params.get("year",  today.year))
            month = int(request.query_params.get("month", today.month))
        except (TypeError, ValueError):
            return Response({"detail": "year y month deben ser enteros."}, status=400)

        if not 1 <= month <= 12:
            return Response({"detail": "month fuera de rango (1-12)."}, status=400)
        if not 2000 <= year <= today.year + 5:
            return Response({"detail": "year fuera de rango permitido."}, status=400)

        try:
            data = PmpService.get_calendar(year, month)
        except PmpServiceError as exc:
            return Response({"detail": str(exc)}, status=502)

        return Response(data)