from datetime import datetime
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from apps.maintenance.services.maintenance_service import MaintenanceService


def _parse_dates(request) -> tuple[str, str]:
    start = request.query_params.get("start_date")
    end   = request.query_params.get("end_date")
    if not start or not end:
        raise ValueError("Params 'start_date' and 'end_date' required (YYYY-MM-DD).")
    datetime.strptime(start, "%Y-%m-%d")
    datetime.strptime(end,   "%Y-%m-%d")
    return start, end


class MaintenanceKPIView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        try:
            start, end = _parse_dates(request)
        except ValueError as e:
            return Response({"detail": str(e)}, status=400)
        data = MaintenanceService.get_kpis(start, end)
        return Response(data)


class MaintenanceReasonsView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        try:
            start, end = _parse_dates(request)
        except ValueError as e:
            return Response({"detail": str(e)}, status=400)
        data = MaintenanceService.get_downtime_reasons(start, end)
        return Response(data)


class MaintenanceDetailView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        try:
            start, end = _parse_dates(request)
        except ValueError as e:
            return Response({"detail": str(e)}, status=400)
        reason = request.query_params.get("reason", "")
        data = MaintenanceService.get_downtime_detail(start, end, reason)
        return Response(data)


class OEETrendView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        try:
            start, end = _parse_dates(request)
        except ValueError as e:
            return Response({"detail": str(e)}, status=400)

        from apps.production.models import OEERecord

        start_date = datetime.strptime(start, "%Y-%m-%d").date()
        end_date   = datetime.strptime(end,   "%Y-%m-%d").date()

        rows = (
            OEERecord.objects
            .filter(date__gte=start_date, date__lt=end_date)
            .order_by("date")
            .values("date", "oee_pct", "availability_pct", "performance_pct", "quality_pct")
        )

        data = [
            {
                "date":             r["date"].strftime("%Y-%m-%d"),
                "oee_pct":          round(float(r["oee_pct"] or 0), 2),
                "availability_pct": round(float(r["availability_pct"] or 0), 2),
                "performance_pct":  round(float(r["performance_pct"] or 0), 2),
                "quality_pct":      round(float(r["quality_pct"] or 0), 2),
            }
            for r in rows
        ]
        return Response({"data": data})


class DowntimeByMonthView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        try:
            start, end = _parse_dates(request)
        except ValueError as e:
            return Response({"detail": str(e)}, status=400)
        data = MaintenanceService.get_downtime_by_month(start, end)
        return Response(data)