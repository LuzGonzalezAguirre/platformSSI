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

        data = MaintenanceService.get_oee_trend_live(start, end)
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
    
class OEELiveView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        try:
            start, end = _parse_dates(request)
        except ValueError as e:
            return Response({"detail": str(e)}, status=400)

        # ── 1. Buscar registro manual en PostgreSQL ───────────────────────
        from datetime import datetime
        from apps.production.repositories.targets_repository import TargetsRepository
        from apps.production.serializers.targets import OEERecordSerializer

        start_date = datetime.strptime(start, "%Y-%m-%d").date()
        end_date   = datetime.strptime(end,   "%Y-%m-%d").date()

        # Busca el registro más reciente dentro del rango
        from apps.production.models import OEERecord
        manual = (
            OEERecord.objects
            .filter(date__gte=start_date, date__lte=end_date)
            .order_by("-date")
            .first()
        )

        if manual:
            # Hay dato manual — lo devuelve con una bandera para que el
            # frontend sepa el origen
            data = OEERecordSerializer(manual).data
            data["source"] = "manual"
            return Response(data)

        # ── 2. Fallback — calcular desde Plex ────────────────────────────
        data = MaintenanceService.get_oee_live(start, end)
        if data is None:
            return Response({})

        data["source"] = "plex"
        return Response(data)