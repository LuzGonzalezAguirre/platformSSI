from django.utils import timezone
from rest_framework import status
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from .models import Notification
from .serializers import NotificationSerializer


class NotificationListView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        queryset = Notification.objects.filter(recipient=request.user)
        scope = request.query_params.get("scope", "all")
        if scope == "unread":
            queryset = queryset.filter(read_at__isnull=True)
        elif scope == "pending":
            queryset = queryset.filter(is_task=True, resolved_at__isnull=True)

        try:
            limit = min(max(int(request.query_params.get("limit", 30)), 1), 100)
        except (TypeError, ValueError):
            limit = 30

        all_for_user = Notification.objects.filter(recipient=request.user)
        return Response({
            "results": NotificationSerializer(queryset[:limit], many=True).data,
            "counts": {
                "unread": all_for_user.filter(read_at__isnull=True).count(),
                "pending": all_for_user.filter(is_task=True, resolved_at__isnull=True).count(),
            },
        })


class NotificationReadView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request, pk):
        notification = Notification.objects.filter(pk=pk, recipient=request.user).first()
        if not notification:
            return Response({"detail": "Not found."}, status=status.HTTP_404_NOT_FOUND)
        notification.mark_read()
        return Response(NotificationSerializer(notification).data)


class NotificationReadAllView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request):
        updated = Notification.objects.filter(
            recipient=request.user,
            read_at__isnull=True,
        ).update(read_at=timezone.now())
        return Response({"updated": updated})
