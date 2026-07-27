# apps/quality/incoming_inspection_urls.py
from django.urls import path
from apps.quality.views.incoming_inspection_views import (
    IncomingInspectionKPIsView,
    IncomingInspectionDetailView,
    IncomingInspectionSLAConfigView,
    IncomingRejectedLotsView,
    IncomingRejectionCommentsView,
    IncomingUserLookupView,
)

urlpatterns = [
    path("kpis/", IncomingInspectionKPIsView.as_view()),
    path("detail/", IncomingInspectionDetailView.as_view()),
    path("sla-config/", IncomingInspectionSLAConfigView.as_view()),
    path("rejected-lots/", IncomingRejectedLotsView.as_view()),
    path("rejected-lots/<str:serial_no>/comments/", IncomingRejectionCommentsView.as_view()),
    path("user-lookup/", IncomingUserLookupView.as_view()),
]