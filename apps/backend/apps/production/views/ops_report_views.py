from datetime import datetime
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from apps.production.services.ops_report_service import OpsReportService


class OpsDailySummaryView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        date_str = request.query_params.get("date")
        try:
            report_date = datetime.strptime(date_str, "%Y-%m-%d").date()
        except (TypeError, ValueError):
            return Response({"detail": "Param 'date' required (YYYY-MM-DD)."}, status=400)
        try:
            data = OpsReportService.get_daily_summary(report_date)
            return Response(data)
        except Exception as e:
            return Response({"detail": str(e)}, status=502)
        
class OpsWeeklyTableView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        date_str = request.query_params.get("date")
        bu_code  = request.query_params.get("bu", "volvo").lower()
        mode     = request.query_params.get("mode", "daily")

        if mode not in ("daily", "weekly", "monthly"):
            return Response({"detail": "mode must be daily, weekly or monthly"}, status=400)

        try:
            report_date = datetime.strptime(date_str, "%Y-%m-%d").date()
        except (TypeError, ValueError):
            return Response({"detail": "Param 'date' required (YYYY-MM-DD)."}, status=400)

        try:
            data = OpsReportService.get_weekly_table(report_date, bu_code, mode)
            return Response(data)
        except Exception as e:
            return Response({"detail": str(e)}, status=502)