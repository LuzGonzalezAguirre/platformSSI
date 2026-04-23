import os, requests
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from rest_framework import status
from django.core.cache import cache

from apps.maintenance.services.ca_service import CorrectiveActionService
from apps.maintenance.serializers.ca_serializer import (
    CorrectiveActionSerializer,
    CorrectiveActionListSerializer,
    CommentSerializer,
)

PROXY_URL    = os.getenv("PLEX_PROXY_URL", "http://host.docker.internal:8001")
PROXY_SECRET = os.getenv("PLEX_PROXY_SECRET", "")
HEADERS      = {"Authorization": f"Bearer {PROXY_SECRET}"}


class CorrectiveActionListCreateView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        filters = {
            "status":       request.query_params.get("status"),
            "priority":     request.query_params.get("priority"),
            "equipment_id": request.query_params.get("equipment_id"),
            "assigned_to":  request.query_params.get("assigned_to"),
        }
        qs   = CorrectiveActionService.list_actions(filters)
        data = CorrectiveActionListSerializer(qs, many=True).data
        return Response(data)

    def post(self, request):
        serializer = CorrectiveActionSerializer(data=request.data)
        if not serializer.is_valid():
            return Response(serializer.errors, status=400)
        obj = CorrectiveActionService.create_action(serializer.validated_data, request.user)
        return Response(CorrectiveActionSerializer(obj).data, status=201)


class CorrectiveActionDetailView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request, pk: int):
        obj = CorrectiveActionService.get_action(pk)
        return Response(CorrectiveActionSerializer(obj).data)

    def patch(self, request, pk: int):
        obj        = CorrectiveActionService.get_action(pk)
        serializer = CorrectiveActionSerializer(obj, data=request.data, partial=True)
        if not serializer.is_valid():
            return Response(serializer.errors, status=400)
        updated = CorrectiveActionService.update_action(pk, serializer.validated_data, request.user)
        return Response(CorrectiveActionSerializer(updated).data)

    def delete(self, request, pk: int):
        CorrectiveActionService.delete_action(pk, request.user)
        return Response(status=status.HTTP_204_NO_CONTENT)


class CorrectiveActionCommentView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request, pk: int):
        text = request.data.get("text", "").strip()
        if not text:
            return Response({"detail": "El comentario no puede estar vacío."}, status=400)
        comment = CorrectiveActionService.add_comment(pk, text, request.user)
        return Response(CommentSerializer(comment).data, status=201)


class CorrectiveActionMetricsView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        from apps.maintenance.models import CorrectiveAction
        from django.db.models import Avg, Count, Q
        from datetime import date

        qs    = CorrectiveAction.objects.all()
        today = date.today()

        total    = qs.count()
        by_status = list(qs.values("status").annotate(count=Count("id")))
        by_priority = list(qs.values("priority").annotate(count=Count("id")))
        overdue  = qs.filter(due_date__lt=today).exclude(status__in=["closed","cancelled"]).count()

        closed   = qs.filter(status="closed", closed_at__isnull=False)
        avg_cycle = None
        for obj in closed:
            pass
        # Calcular promedio de cycle_time en Python (closed_at - created_at)
        cycle_times = [
            (o.closed_at.date() - o.created_at.date()).days
            for o in closed if o.closed_at
        ]
        avg_cycle = round(sum(cycle_times) / len(cycle_times), 1) if cycle_times else None

        # Equipos con más fallas
        top_equipment = list(
            qs.exclude(equipment_id="")
            .values("equipment_id", "equipment_desc")
            .annotate(count=Count("id"))
            .order_by("-count")[:5]
        )

        return Response({
            "total":        total,
            "overdue":      overdue,
            "avg_cycle_days": avg_cycle,
            "by_status":    by_status,
            "by_priority":  by_priority,
            "top_equipment": top_equipment,
        })


class EquipmentCatalogView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        key    = "maint:equipment_catalog"
        cached = cache.get(key)
        if cached:
            return Response(cached)
        try:
            resp = requests.get(f"{PROXY_URL}/equipment", headers=HEADERS, timeout=30)
            resp.raise_for_status()
            data = resp.json()
            cache.set(key, data, 3600)
            return Response(data)
        except Exception as e:
            return Response({"detail": str(e)}, status=502)


class AssigneeCatalogView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        from django.contrib.auth import get_user_model
        User = get_user_model()
        # Solo técnicos/ingenieros de mantenimiento — sin admin ni gerente
        ASSIGNEE_SLUGS = ["maintenance_engineer"]
        users = (
            User.objects
            .filter(is_active=True, user_roles__role__slug__in=ASSIGNEE_SLUGS)
            .distinct()
            .prefetch_related("user_roles__role")
        )
        data = [
            {
                "id":   u.id,
                "name": f"{u.first_name} {u.last_name}".strip(),
                "role": ", ".join(ur.role.name for ur in u.user_roles.all()),
            }
            for u in users
        ]
        return Response(data)