from datetime import datetime

from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status
from rest_framework.permissions import IsAuthenticated

from apps.quality.cogp.serializers.cogp_serializers import CogpSummaryResponseSerializer
from apps.quality.cogp.services.cogp_live_trend_service import CogpLiveTrendService
from apps.quality.models import CustomerPartMapping
from apps.quality.cogp.services.cogp_pareto_service import CogpParetoService



ALLOWED_ROLES = {"quality_engineer", "plant_manager", "admin"}

class CogpParetoView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        user_roles = set(request.user.roles.values_list("slug", flat=True))
        if not user_roles & ALLOWED_ROLES:
            return Response(
                {"detail": "No tienes permiso para ver este reporte."},
                status=status.HTTP_403_FORBIDDEN,
            )

        period = request.query_params.get("period", "week")
        if period not in ("day", "week", "month"):
            return Response(
                {"detail": "period debe ser day, week o month."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        date_str = request.query_params.get("date")
        if not date_str:
            return Response(
                {"detail": "date es requerido (YYYY-MM-DD)."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        try:
            reference_date = datetime.strptime(date_str, "%Y-%m-%d").date()
        except ValueError:
            return Response(
                {"detail": "Formato de fecha invalido, usar YYYY-MM-DD."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        service = CogpParetoService()
        result = service.get_pareto(period, reference_date)
        return Response(result)
class CogpSummaryView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        user_roles = set(
            request.user.roles.values_list("slug", flat=True)
        )
        if not user_roles & ALLOWED_ROLES:
            return Response(
                {"detail": "No tienes permiso para ver este reporte."},
                status=status.HTTP_403_FORBIDDEN,
            )

        start_date_str = request.query_params.get("start_date")
        end_date_str = request.query_params.get("end_date")

        if not start_date_str or not end_date_str:
            return Response(
                {"detail": "start_date y end_date son requeridos (YYYY-MM-DD)."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        try:
            start_date = datetime.strptime(start_date_str, "%Y-%m-%d").date()
            end_date = datetime.strptime(end_date_str, "%Y-%m-%d").date()
        except ValueError:
            return Response(
                {"detail": "Formato de fecha invalido, usar YYYY-MM-DD."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        if end_date < start_date:
            return Response(
                {"detail": "end_date debe ser mayor o igual a start_date."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        service = CogpLiveTrendService()
        result = service.get_summary_for_range(start_date, end_date)

        serializer = CogpSummaryResponseSerializer(result)
        return Response(serializer.data)

class CogpWeeklyTrendView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        user_roles = set(
            request.user.roles.values_list("slug", flat=True)
        )
        if not user_roles & ALLOWED_ROLES:
            return Response(
                {"detail": "No tienes permiso para ver este reporte."},
                status=status.HTTP_403_FORBIDDEN,
            )

        start_date_str = request.query_params.get("start_date")
        end_date_str = request.query_params.get("end_date")

        if not start_date_str or not end_date_str:
            return Response(
                {"detail": "start_date y end_date son requeridos (YYYY-MM-DD)."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        try:
            start_date = datetime.strptime(start_date_str, "%Y-%m-%d").date()
            end_date = datetime.strptime(end_date_str, "%Y-%m-%d").date()
        except ValueError:
            return Response(
                {"detail": "Formato de fecha invalido, usar YYYY-MM-DD."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        service = CogpLiveTrendService()
        result = service.get_weekly_trend(start_date, end_date)
        return Response(result)

class CogpMappingCatalogView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        user_roles = set(request.user.roles.values_list("slug", flat=True))
        if not user_roles & ALLOWED_ROLES:
            return Response(
                {"detail": "No tienes permiso para ver este catalogo."},
                status=status.HTTP_403_FORBIDDEN,
            )

        qs = CustomerPartMapping.objects.all().order_by("part_no")

        bu = request.query_params.get("business_unit")
        if bu:
            qs = qs.filter(business_unit=bu)

        search = request.query_params.get("search")
        if search:
            from django.db.models import Q
            qs = qs.filter(Q(part_no__icontains=search) | Q(part_name__icontains=search))

        data = [
            {
                "part_no": r.part_no,
                "part_name": r.part_name,
                "customer_no": r.customer_no,
                "customer_name": r.customer_name,
                "business_unit": r.business_unit,
                "classification_source": r.classification_source,
            }
            for r in qs[:2000]  # tope simple, sin paginacion formal por ahora
        ]
        return Response({"count": qs.count(), "results": data})