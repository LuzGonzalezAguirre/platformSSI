from django.urls import path
from apps.audit.views import AuditUserListView, AuditLogListView

urlpatterns = [
    path("users/", AuditUserListView.as_view(), name="audit-users"),
    path("logs/", AuditLogListView.as_view(), name="audit-logs"),
]
