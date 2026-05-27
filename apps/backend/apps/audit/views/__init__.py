from rest_framework.views import APIView
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.pagination import PageNumberPagination
from django.db.models import Count, Max, Q
from django.utils import timezone
from datetime import timedelta

from apps.audit.models import AuditLog
from apps.audit.serializers import AuditLogSerializer, UserActivitySerializer
from apps.identity.models import User


class AuditUserListView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        cutoff = timezone.now() - timedelta(days=30)
        users = User.objects.annotate(
            last_action_at=Max(
                "audit_logs__timestamp",
                filter=Q(audit_logs__timestamp__gte=cutoff),
            ),
            total_actions=Count(
                "audit_logs",
                filter=Q(audit_logs__timestamp__gte=cutoff),
            ),
        ).order_by("-last_login_at")
        serializer = UserActivitySerializer(users, many=True)
        return Response(serializer.data)


class AuditLogListView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        queryset = AuditLog.objects.select_related("user").all()

        user_id = request.query_params.get("user_id")
        action = request.query_params.get("action")
        module = request.query_params.get("module")
        date_from = request.query_params.get("date_from")
        date_to = request.query_params.get("date_to")
        search = request.query_params.get("search")

        if user_id:
            queryset = queryset.filter(user_id=user_id)
        if action:
            queryset = queryset.filter(action=action)
        if module:
            queryset = queryset.filter(module=module)
        if date_from:
            queryset = queryset.filter(timestamp__date__gte=date_from)
        if date_to:
            queryset = queryset.filter(timestamp__date__lte=date_to)
        if search:
            queryset = queryset.filter(
                Q(user__employee_id__icontains=search)
                | Q(user__first_name__icontains=search)
                | Q(user__last_name__icontains=search)
            )

        paginator = PageNumberPagination()
        paginator.page_size = 50
        page = paginator.paginate_queryset(queryset, request)
        serializer = AuditLogSerializer(page, many=True)
        return paginator.get_paginated_response(serializer.data)
