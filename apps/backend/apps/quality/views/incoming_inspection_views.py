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
)
from apps.quality.services import incoming_inspection_kpi_service as kpi_service
from apps.quality.services import incoming_inspection_sla_config_service as sla_service

ALLOWED_SORT_FIELDS = {"change_date", "-change_date", "part_no", "-part_no", "operation_no", "-operation_no"}
KPI_CACHE_TTL = 90


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

        page_size = min(int(request.query_params.get("page_size", 50)), 200)
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
        try:
            new_value = int(request.data.get("threshold_hours"))
        except (TypeError, ValueError):
            return Response({"error": "threshold_hours inválido."}, status=400)

        # KPI cache TTL es de 90s (ver KPI_CACHE_TTL) — se auto-invalida solo,
        # no vale la pena mantener un índice de keys por combinación de filtros.
        obj = sla_service.update_threshold(new_value, request.user)
        return Response(IncomingInspectionSLAConfigSerializer(obj).data)
