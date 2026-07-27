# apps/quality/views/incoming_inspection_views.py
import hashlib
import json

from django.core.cache import cache
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from rest_framework.pagination import PageNumberPagination

from apps.quality.serializers import (
    IncomingContainerHistorySerializer,
    IncomingInspectionSLAConfigSerializer,
    IncomingRejectionCommentSerializer,
)
from apps.quality.services import incoming_inspection_kpi_service as kpi_service
from apps.quality.services import incoming_inspection_sla_config_service as sla_service
from apps.quality.services import incoming_inspection_rejection_comment_service as comment_service
from apps.quality.services import incoming_inspection_user_lookup_service as user_lookup_service

ALLOWED_SORT_FIELDS = {"change_date", "-change_date", "part_no", "-part_no", "operation_no", "-operation_no"}
KPI_CACHE_TTL = 90

# Se abandonó la paginación con botones ← → en el frontend (single scroll
# list en su lugar) — este tope protege contra rangos de fecha muy amplios
# que traerían decenas de miles de filas al navegador de una sola vez. Si
# el conteo real excede esto, el frontend muestra un aviso pidiendo acotar
# el rango en vez de intentar renderizar todo.
MAX_PAGE_SIZE = 3000

ALLOWED_SLA_WRITE_ROLES = {"admin", "quality_engineer"}


def _has_sla_write_access(request) -> bool:
    roles = set(request.user.user_roles.values_list("role__slug", flat=True))
    return bool(roles & ALLOWED_SLA_WRITE_ROLES)


def _forbidden():
    return Response({"detail": "Forbidden"}, status=403)


def _parse_filters(request) -> dict:
    params = request.query_params
    filters = {}
    for key in ("date_from", "date_to", "part_no", "location", "container_status", "defect_type", "sla_status"):
        value = params.get(key)
        if value:
            filters[key] = value
    operation_no = params.get("operation_no")
    if operation_no:
        filters["operation_no"] = int(operation_no)
    return filters


class IncomingInspectionKPIsView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        filters = _parse_filters(request)
        cache_key = "incoming_inspection:kpis:" + hashlib.sha256(
            json.dumps(filters, sort_keys=True).encode()
        ).hexdigest()

        cached = cache.get(cache_key)
        if cached is not None:
            return Response(cached)

        data = {
            "operation_counts": kpi_service.get_operation_counts(filters),
            "lots_inspected": kpi_service.get_lots_inspected(filters),
            "acceptance_rate": kpi_service.get_acceptance_rate(filters),
            "sla_compliance": kpi_service.get_sla_compliance(filters),
        }
        cache.set(cache_key, data, KPI_CACHE_TTL)
        return Response(data)


class IncomingInspectionDetailView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        filters = _parse_filters(request)
        ordering = request.query_params.get("ordering", "-change_date")
        if ordering not in ALLOWED_SORT_FIELDS:
            ordering = "-change_date"

        page_size = min(int(request.query_params.get("page_size", 50)), MAX_PAGE_SIZE)
        paginator = PageNumberPagination()
        paginator.page_size = page_size

        qs = kpi_service.get_detail_queryset(filters, ordering=ordering)
        page = paginator.paginate_queryset(qs, request)
        serializer = IncomingContainerHistorySerializer(page, many=True)
        return paginator.get_paginated_response(serializer.data)


class IncomingInspectionSLAConfigView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        return Response({"threshold_hours": sla_service.get_current_threshold()})

    def patch(self, request):
        if not _has_sla_write_access(request):
            return _forbidden()

        try:
            new_value = int(request.data.get("threshold_hours"))
        except (TypeError, ValueError):
            return Response({"error": "threshold_hours inválido."}, status=400)

        obj = sla_service.update_threshold(new_value, request.user)
        return Response(IncomingInspectionSLAConfigSerializer(obj).data)


class IncomingRejectedLotsView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        filters = _parse_filters(request)
        page_size = min(int(request.query_params.get("page_size", 50)), MAX_PAGE_SIZE)
        paginator = PageNumberPagination()
        paginator.page_size = page_size

        qs = kpi_service.get_rejected_lots_queryset(filters)
        page = paginator.paginate_queryset(qs, request)
        serializer = IncomingContainerHistorySerializer(page, many=True)
        return paginator.get_paginated_response(serializer.data)


class IncomingRejectionCommentsView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request, serial_no):
        qs = comment_service.list_comments(serial_no)
        serializer = IncomingRejectionCommentSerializer(qs, many=True)
        return Response(serializer.data)

    def post(self, request, serial_no):
        comment_text = request.data.get("comment", "")
        try:
            obj = comment_service.create_comment(serial_no, request.user, comment_text)
        except ValueError as exc:
            return Response({"error": str(exc)}, status=400)
        return Response(IncomingRejectionCommentSerializer(obj).data, status=201)


class IncomingUserLookupView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request):
        user_nos = request.data.get("user_nos", [])
        try:
            user_nos = [int(n) for n in user_nos]
        except (TypeError, ValueError):
            return Response({"error": "user_nos debe ser una lista de números."}, status=400)

        mapping = user_lookup_service.resolve_user_names(user_nos)
        return Response({str(k): v for k, v in mapping.items()})