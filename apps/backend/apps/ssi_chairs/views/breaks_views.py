from datetime import date, timedelta

from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated

from ..services.breaks_service import BreaksService


class BreaksListView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        start_str = request.query_params.get("start_date")
        end_str = request.query_params.get("end_date")
        turno = request.query_params.get("turno") or None
        department = request.query_params.get("department") or None
        search = request.query_params.get("search") or None
        order_by = request.query_params.get("order_by", "check_in")
        order_dir = request.query_params.get("order_dir", "DESC")

        try:
            page = max(1, int(request.query_params.get("page", 1)))
            page_size = min(100, max(1, int(request.query_params.get("page_size", 20))))
            start_date = date.fromisoformat(start_str) if start_str else date.today() - timedelta(days=30)
            end_date = date.fromisoformat(end_str) if end_str else date.today()
        except ValueError:
            return Response({"error": "Parámetros inválidos."}, status=400)

        data = BreaksService.get_breaks(
            start_date, end_date, turno, department, search, page, page_size, order_by, order_dir
        )
        return Response(data)


class BreaksDailyChartView(APIView):
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
            return Response({"error": "Formato de fecha inválido."}, status=400)

        data = BreaksService.get_daily_chart(start_date, end_date, turno, department)
        return Response(data)


class BreaksTurnoChartView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        start_str = request.query_params.get("start_date")
        end_str = request.query_params.get("end_date")

        try:
            start_date = date.fromisoformat(start_str) if start_str else date.today() - timedelta(days=30)
            end_date = date.fromisoformat(end_str) if end_str else date.today()
        except ValueError:
            return Response({"error": "Formato de fecha inválido."}, status=400)

        data = BreaksService.get_turno_distribution(start_date, end_date)
        return Response(data)
