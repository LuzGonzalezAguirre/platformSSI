from datetime import date, timedelta

from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated

from ..services.kpi_service import KpiService


class KpiView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        start_str = request.query_params.get("start_date")
        end_str = request.query_params.get("end_date")
        turno = request.query_params.get("turno") or None
        department = request.query_params.get("department") or None

        try:
            start_date = date.fromisoformat(start_str) if start_str else date.today() - timedelta(days=30)
            end_date = date.fromisoformat(end_str) if end_str else date.today()
        except ValueError:
            return Response({"error": "Formato de fecha inválido. Use YYYY-MM-DD."}, status=400)

        data = KpiService.get_kpis(start_date, end_date, turno, department)
        return Response(data)
