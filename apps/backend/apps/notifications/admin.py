from django.contrib import admin

from .models import Notification


@admin.register(Notification)
class NotificationAdmin(admin.ModelAdmin):
    list_display = ("title", "recipient", "module", "is_task", "read_at", "resolved_at", "created_at")
    list_filter = ("module", "notification_type", "is_task", "created_at")
    search_fields = ("title", "message", "recipient__employee_id", "event_key")
    readonly_fields = ("created_at", "updated_at")

