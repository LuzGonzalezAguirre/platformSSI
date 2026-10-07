from datetime import datetime
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from apps.maintenance.services.maintenance_service import MaintenanceService
from apps.maintenance.filters import MaintenanceFilterSerializer
from apps.ssi_common.filters.rbac import ALL_BU_CODES, get_allowed_bu_for_user


def _scoped_filter_context(request):
    serializer = MaintenanceFilterSerializer(data=request.query_params)
    serializer.is_valid(raise_exception=True)
    return serializer.to_filter_context().restricted_to_bu(
        get_allowed_bu_for_user(request.user)
    )


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
        filter_ctx = _scoped_filter_context(request)
        data = MaintenanceService.get_kpis(filter_ctx)
        return Response(data)


class MaintenanceReasonsView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        filter_ctx = _scoped_filter_context(request)
        data = MaintenanceService.get_downtime_reasons_scoped(filter_ctx)
        return Response(data)


class MaintenanceDetailView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        filter_ctx = _scoped_filter_context(request)
        reason = request.query_params.get("reason", "")
        data = MaintenanceService.get_downtime_detail_scoped(filter_ctx, reason)
        return Response(data)


class OEETrendView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        filter_ctx = _scoped_filter_context(request)
        data = MaintenanceService.get_oee_trend_live_scoped(filter_ctx)
        return Response({"data": data})

class DowntimeByMonthView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        filter_ctx = _scoped_filter_context(request)
        data = MaintenanceService.get_downtime_by_month_scoped(filter_ctx)
        return Response(data)
    
class OEELiveView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        filter_ctx = _scoped_filter_context(request)
        start = filter_ctx.start_date.isoformat()
        end = filter_ctx.end_date.isoformat()

        from datetime import datetime
        from apps.production.models import OEERecord
        from apps.production.serializers.targets import OEERecordSerializer

        start_date = datetime.strptime(start, "%Y-%m-%d").date()
        end_date   = datetime.strptime(end,   "%Y-%m-%d").date()

        # El override manual solo aplica a consultas de UN SOLO DIA.
        # Para rangos multi-dia, siempre se calcula desde Plex --
        # mezclar un registro manual de un dia con el calculo agregado
        # de varios dias no tiene sentido de negocio.
        if start_date == end_date and set(filter_ctx.bu) == set(ALL_BU_CODES):
            manual = OEERecord.objects.filter(date=start_date).first()
            if manual:
                data = OEERecordSerializer(manual).data
                data["source"] = "manual"
                return Response(data)

        data = MaintenanceService.get_oee_live_scoped(filter_ctx)
        if data is None:
            return Response({})

        data["source"] = "plex"
        return Response(data)