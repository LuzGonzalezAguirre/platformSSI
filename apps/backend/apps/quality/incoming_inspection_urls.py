# apps/quality/incoming_inspection_urls.py
from django.urls import path
from apps.permissions.drf import quality_view
from apps.quality.views.incoming_inspection_views import (
    IncomingInspectionDashboardView,
    IncomingInspectionPendingView,
    IncomingInspectionKPIsView,
    IncomingInspectionDetailView,
    IncomingInspectionSLAConfigView,
    IncomingRejectedLotsView,
    IncomingRejectionCommentsView,
    IncomingUserLookupView,
    IncomingInspectionRefreshView,
    IncomingInspectionRefreshStatusView,
)

urlpatterns = [
    path("refresh/", quality_view(IncomingInspectionRefreshView, {"POST": "edit"})),
    path("refresh/<str:task_id>/", quality_view(IncomingInspectionRefreshStatusView)),
    path("dashboard/", quality_view(IncomingInspectionDashboardView)),
    path("pending/", quality_view(IncomingInspectionPendingView)),
    path("kpis/", quality_view(IncomingInspectionKPIsView)),
    path("detail/", quality_view(IncomingInspectionDetailView)),
    path("sla-config/", quality_view(IncomingInspectionSLAConfigView)),
    path("rejected-lots/", quality_view(IncomingRejectedLotsView)),
    path("rejected-lots/<str:serial_no>/comments/", quality_view(IncomingRejectionCommentsView)),
    path("user-lookup/", quality_view(IncomingUserLookupView, {"POST": "view"})),
]
