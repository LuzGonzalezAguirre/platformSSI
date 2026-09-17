from rest_framework import serializers

from .models import Notification


class NotificationSerializer(serializers.ModelSerializer):
    is_pending = serializers.BooleanField(read_only=True)

    class Meta:
        model = Notification
        fields = [
            "id", "notification_type", "title", "message", "module",
            "entity_type", "entity_id", "action_url", "metadata", "is_task",
            "is_pending", "read_at", "resolved_at", "created_at",
        ]

