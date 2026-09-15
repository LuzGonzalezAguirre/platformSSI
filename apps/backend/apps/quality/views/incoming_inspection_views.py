# apps/quality/views/incoming_inspection_views.py
import hashlib
import json
from uuid import uuid4

from celery.result import AsyncResult
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
from apps.quality.services import incoming_inspection_dashboard_service as dashboard_service
from apps.quality.services import incoming_inspection_pending_service as pending_service
from apps.quality.tasks import (
    INCOMING_REFRESH_LOCK_KEY,
    INCOMING_REFRESH_TASK_KEY_PREFIX,
    INCOMING_REFRESH_TTL,
    refresh_incoming_inspection,
)

ALLOWED_SORT_FIELDS = {"change_date", "-change_date", "part_no", "-part_no", "operation_no", "-operation_no"}

# Bump al cambiar la forma de cualquier payload cacheado. Redis no expone
# delete_pattern en esta configuración — versionar la llave es la única
# invalidación confiable.
CACHE_VERSION = "v2"
KPI_CACHE_TTL = 90
DASHBOARD_CACHE_TTL = 90
PENDING_CACHE_TTL = 45

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


def _cache_key(namespace: str, filters: dict) -> str:
    digest = hashlib.sha256(json.dumps(filters, sort_keys=True).encode()).hexdigest()
    return f"incoming_inspection:{namespace}:{CACHE_VERSION}:{digest}"


def _use_cache(request) -> bool:
    return request.query_params.get("_fresh") != "1"


def _parse_filters(request) -> dict:
    params = request.query_params
    filters = {}
    for key in ("date_from", "date_to", "part_no", "location", "container_status", "defect_type", "sla_status"):
        value = params.get(key)
        if value:
            filters[key] = value

    # date_to llega como YYYY-MM-DD y Postgres lo interpreta como medianoche,
    # lo que descartaba silenciosamente el último día completo del rango.
    date_to = filters.get("date_to")
    if date_to and len(date_to) == 10:
        filters["date_to"] = f"{date_to} 23:59:59.999999"

    operation_no = params.get("operation_no")
    if operation_no:
        filters["operation_no"] = int(operation_no)
    return filters


class IncomingInspectionDashboardView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        filters = _parse_filters(request)
        cache_key = _cache_key("dashboard", filters)

        if _use_cache(request):
            cached = cache.get(cache_key)
            if cached is not None:
                return Response(cached)

        data = dashboard_service.get_dashboard(filters)
        if _use_cache(request):
            cache.set(cache_key, data, DASHBOARD_CACHE_TTL)
        return Response(data)


class IncomingInspectionPendingView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        filters = _parse_filters(request)
        cache_key = _cache_key("pending", filters)

        if _use_cache(request):
            cached = cache.get(cache_key)
            if cached is not None:
                return Response(cached)

        data = pending_service.get_pending_backlog(filters)
        if _use_cache(request):
            cache.set(cache_key, data, PENDING_CACHE_TTL)
        return Response(data)


class IncomingInspectionKPIsView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        filters = _parse_filters(request)
        cache_key = _cache_key("kpis", filters)

        if _use_cache(request):
            cached = cache.get(cache_key)
            if cached is not None:
                return Response(cached)

        data = {
            "operation_counts": kpi_service.get_operation_counts(filters),
            "lots_inspected": kpi_service.get_lots_inspected(filters),
            "acceptance_rate": kpi_service.get_acceptance_rate(filters),
            "sla_compliance": kpi_service.get_sla_compliance(filters),
        }
        if _use_cache(request):
            cache.set(cache_key, data, KPI_CACHE_TTL)
        return Response(data)


class IncomingInspectionRefreshView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request):
        active_task_id = cache.get(INCOMING_REFRESH_LOCK_KEY)
        if active_task_id:
            state = AsyncResult(active_task_id).state
            if state in {"PENDING", "RECEIVED", "STARTED", "RETRY"}:
                return Response({"task_id": active_task_id, "status": "refreshing"}, status=202)

        # Reservar el refresh antes de enviarlo a Celery. cache.add es
        # atómico en Redis: si dos pestañas abren Incoming al mismo tiempo,
        # sólo una crea la tarea y la otra reutiliza su task_id.
        task_id = str(uuid4())
        if not cache.add(INCOMING_REFRESH_LOCK_KEY, task_id, INCOMING_REFRESH_TTL):
            active_task_id = cache.get(INCOMING_REFRESH_LOCK_KEY)
            return Response(
                {"task_id": active_task_id, "status": "refreshing"},
                status=202,
            )

        cache.set(
            f"{INCOMING_REFRESH_TASK_KEY_PREFIX}{task_id}",
            True,
            INCOMING_REFRESH_TTL,
        )
        try:
            refresh_incoming_inspection.apply_async(task_id=task_id)
        except Exception:
            cache.delete(f"{INCOMING_REFRESH_TASK_KEY_PREFIX}{task_id}")
            if cache.get(INCOMING_REFRESH_LOCK_KEY) == task_id:
                cache.delete(INCOMING_REFRESH_LOCK_KEY)
            raise

        return Response({"task_id": task_id, "status": "refreshing"}, status=202)


class IncomingInspectionRefreshStatusView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request, task_id):
        if not cache.get(f"{INCOMING_REFRESH_TASK_KEY_PREFIX}{task_id}"):
            return Response({"detail": "Actualizacion no encontrada o expirada."}, status=404)

        task = AsyncResult(task_id)
        if task.state == "SUCCESS":
            return Response({"task_id": task_id, "status": "ready", "result": task.result})
        if task.state == "FAILURE":
            return Response(
                {"task_id": task_id, "status": "error", "detail": "No fue posible actualizar los datos desde Plex."},
                status=502,
            )
        return Response({"task_id": task_id, "status": "refreshing"}, status=202)


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
