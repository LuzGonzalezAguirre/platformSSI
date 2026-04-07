from django.urls import path
from apps.maintenance.views.overview_views import (
    MaintenanceKPIView,
    MaintenanceReasonsView,
    MaintenanceDetailView,
    OEETrendView,
    DowntimeByMonthView,
)
from apps.maintenance.views.work_requests_views import WorkRequestsDashboardView


urlpatterns = [
     path('overview/kpis/',              MaintenanceKPIView.as_view()),
    path('overview/reasons/',           MaintenanceReasonsView.as_view()),
    path('overview/detail/',            MaintenanceDetailView.as_view()),
    path('overview/oee-trend/',         OEETrendView.as_view()),
    path('overview/downtime-by-month/', DowntimeByMonthView.as_view()),
    path('work-requests/dashboard/',    WorkRequestsDashboardView.as_view()),
]