from datetime import datetime

from rest_framework import status
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.production.serializers.productivity import DailyProductivitySerializer
from apps.production.services.productivity_service import ProductivityService


class DailyProductivityView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        date_str = request.query_params.get("date")
        turno    = request.query_params.get("turno") or None

        try:
            target_date = datetime.strptime(date_str, "%Y-%m-%d").date()
        except (TypeError, ValueError):
            return Response(
                {"detail": "Param 'date' required (YYYY-MM-DD)."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        if turno and turno not in ("A", "B"):
            return Response(
                {"detail": "Param 'turno' must be 'A' or 'B'."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        data = ProductivityService.get_daily_productivity(target_date, turno)
        return Response(DailyProductivitySerializer(data).data)