from datetime import datetime

from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status
from rest_framework.permissions import IsAuthenticated
from rest_framework import serializers
from decimal import Decimal
import requests

from apps.quality.cogp.serializers.cogp_serializers import CogpSummaryResponseSerializer
from apps.quality.cogp.services.cogp_live_trend_service import CogpLiveTrendService
from apps.quality.models import CustomerPartMapping, CogpSettings
from apps.quality.cogp.services.cogp_pareto_service import CogpParetoService
from apps.quality.cogp.services.scrap_action_service import manual_test, stage_current_offenders

from apps.quality.cogp.services.scrap_rate_service import ScrapRateService
from apps.ssi_common.filters.base import BaseRangeFilterSerializer


ALLOWED_ROLES = {"quality_engineer", "plant_manager", "admin"}


class CogpScrapIntegrationTestView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request):
        if not request.user.is_superuser and not request.user.roles.filter(slug__in=("quality_engineer", "admin")).exists():
            return Response({"detail": "No tienes permiso para probar la integración."}, status=status.HTTP_403_FORBIDDEN)
        serializer = CogpIntegrationTestSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        try:
            return Response(manual_test(serializer.validated_data), status=status.HTTP_201_CREATED)
        except (ValueError, KeyError, TypeError) as exc:
            return Response({"detail": str(exc)}, status=status.HTTP_400_BAD_REQUEST)
        except requests.HTTPError as exc:
            response = exc.response
            detail = None
            if response is not None:
                try:
                    detail = response.json().get("detail")
                except Exception:
                    detail = response.text[:500]
            return Response(
                {"detail": f"qwall-proxy respondió con error: {detail or str(exc)}"},
                status=status.HTTP_503_SERVICE_UNAVAILABLE,
            )
        except requests.RequestException as exc:
            return Response(
                {"detail": f"No se pudo contactar qwall-proxy: {type(exc).__name__}: {exc}"},
                status=status.HTTP_503_SERVICE_UNAVAILABLE,
            )
        except Exception as exc:
            return Response(
                {"detail": f"Error de integración COGP: {type(exc).__name__}: {exc}"},
                status=status.HTTP_503_SERVICE_UNAVAILABLE,
            )


class CogpCurrentOffendersView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request):
        if not request.user.is_superuser and not request.user.roles.filter(slug__in=("quality_engineer", "admin")).exists():
            return Response({"detail": "No tienes permiso para enviar ofensores."}, status=status.HTTP_403_FORBIDDEN)

        serializer = CogpCurrentOffendersSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data
        try:
            result = stage_current_offenders(
                data["start_date"],
                data["end_date"],
                tuple(data.get("workcenter") or ()),
            )
            return Response(result, status=status.HTTP_201_CREATED)
        except (ValueError, KeyError, TypeError) as exc:
            return Response({"detail": str(exc)}, status=status.HTTP_400_BAD_REQUEST)
        except requests.HTTPError as exc:
            response = exc.response
            detail = None
            if response is not None:
                try:
                    detail = response.json().get("detail")
                except Exception:
                    detail = response.text[:500]
            return Response(
                {"detail": f"qwall-proxy respondió con error: {detail or str(exc)}"},
                status=status.HTTP_503_SERVICE_UNAVAILABLE,
            )
        except requests.RequestException as exc:
            return Response(
                {"detail": f"No se pudo contactar qwall-proxy: {type(exc).__name__}: {exc}"},
                status=status.HTTP_503_SERVICE_UNAVAILABLE,
            )
        except Exception as exc:
            return Response(
                {"detail": f"Error enviando ofensores COGP: {type(exc).__name__}: {exc}"},
                status=status.HTTP_503_SERVICE_UNAVAILABLE,
            )


class CogpCurrentOffendersSerializer(serializers.Serializer):
    start_date = serializers.DateField()
    end_date = serializers.DateField()
    workcenter = serializers.ListField(
        child=serializers.CharField(max_length=150),
        required=False,
        default=list,
    )


class CogpIntegrationTestSerializer(serializers.Serializer):
    test_run_id = serializers.UUIDField()
    business_unit = serializers.ChoiceField(choices=("VOLVO", "CUMMINS", "TULC", "JOHN_DEERE", "EATON"))
    workcenter = serializers.CharField(max_length=150)
    part_no = serializers.CharField(max_length=80)
    part_name = serializers.CharField(max_length=250, required=False, allow_blank=True)
    reason = serializers.CharField(max_length=250)
    scrap_cost = serializers.DecimalField(max_digits=18, decimal_places=2, min_value=Decimal("0"))
    production_cost = serializers.DecimalField(max_digits=18, decimal_places=2, min_value=Decimal("0"))
    scrap_qty = serializers.IntegerField(min_value=0)
    produced_qty = serializers.IntegerField(min_value=0)


class CogpSettingsSerializer(serializers.Serializer):
    cost_target_pct = serializers.DecimalField(max_digits=5, decimal_places=2, min_value=Decimal("0.01"), max_value=Decimal("100"))
    pieces_target_pct = serializers.DecimalField(max_digits=5, decimal_places=2, min_value=Decimal("0.01"), max_value=Decimal("100"))


class CogpSettingsView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        if not request.user.roles.filter(slug__in=ALLOWED_ROLES).exists() and not request.user.is_superuser:
            return Response({"detail": "No tienes permiso para ver este reporte."}, status=status.HTTP_403_FORBIDDEN)
        obj = CogpSettings.get_solo()
        return Response({**CogpSettingsSerializer(obj).data, "can_edit": request.user.is_superuser or request.user.roles.filter(slug__in=("admin", "quality_engineer")).exists()})

    def put(self, request):
        if not request.user.is_superuser and not request.user.roles.filter(slug__in=("admin", "quality_engineer")).exists():
            return Response({"detail": "No tienes permiso para cambiar los targets."}, status=status.HTTP_403_FORBIDDEN)
        serializer = CogpSettingsSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        obj = CogpSettings.get_solo()
        obj.cost_target_pct = serializer.validated_data["cost_target_pct"]
        obj.pieces_target_pct = serializer.validated_data["pieces_target_pct"]
        obj.save(update_fields=["cost_target_pct", "pieces_target_pct", "updated_at"])
        return Response({**CogpSettingsSerializer(obj).data, "can_edit": True})

class CogpParetoView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        user_roles = set(request.user.roles.values_list("slug", flat=True))
        if not user_roles & ALLOWED_ROLES:
            return Response(
                {"detail": "No tienes permiso para ver este reporte."},
                status=status.HTTP_403_FORBIDDEN,
            )

        serializer = BaseRangeFilterSerializer(data=request.query_params)
        serializer.is_valid(raise_exception=True)
        ctx = serializer.to_filter_context()

        service = CogpParetoService()
        try:
            result = service.get_pareto(
                ctx.start_date, ctx.end_date, workcenter_filter=ctx.workcenter
            )
        except ValueError as exc:
            return Response({"detail": str(exc)}, status=status.HTTP_400_BAD_REQUEST)

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
        user_roles = set(request.user.roles.values_list("slug", flat=True))
        if not user_roles & ALLOWED_ROLES:
            return Response(
                {"detail": "No tienes permiso para ver este reporte."},
                status=status.HTTP_403_FORBIDDEN,
            )

        serializer = BaseRangeFilterSerializer(data=request.query_params)
        serializer.is_valid(raise_exception=True)
        ctx = serializer.to_filter_context()

        service = CogpLiveTrendService()
        try:
            result = service.get_weekly_trend(
                ctx.start_date, ctx.end_date, workcenter_filter=ctx.workcenter
            )
        except ValueError as exc:
            return Response({"detail": str(exc)}, status=status.HTTP_400_BAD_REQUEST)

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


class ScrapRateWeeklyView(APIView):
    """
    GET /api/v1/quality/cogp/scrap-rate/
        ?start_date=YYYY-MM-DD&end_date=YYYY-MM-DD&bu=VOLVO&bu=TULC

    Tendencia semanal de scrap rate en piezas. Read-only: no escribe en
    Plex ni en Postgres, solo consulta el proxy y cachea en Redis.

    `bu` acepta cero, uno o varios valores (contrato estandar de filtros,
    igual que BUSelect en el resto del proyecto). Sin `bu`, el servicio
    suma VOLVO+CUMMINS+TULC por defecto -- ver ScrapRateService para el
    porque de que esto no dispara queries adicionales a Plex.

    La validacion de BUs validos vive UNICAMENTE en ScrapRateService
    (ALLOWED_BUSINESS_UNITS) para no mantener dos listas que se puedan
    desincronizar; aqui solo se recolecta el parametro y se traduce el
    ValueError del servicio a 400.
    """

    permission_classes = [IsAuthenticated]

    def get(self, request):
        user_roles = set(request.user.roles.values_list("slug", flat=True))
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

        business_units = [
            v.strip().upper()
            for v in request.query_params.getlist("bu")
            if v.strip()
        ]

        service = ScrapRateService()
        try:
            result = service.get_weekly_scrap_rate(
                start_date, end_date, business_units or None
            )
        except ValueError as exc:
            return Response(
                {"detail": str(exc)},
                status=status.HTTP_400_BAD_REQUEST,
            )

        return Response(result)
