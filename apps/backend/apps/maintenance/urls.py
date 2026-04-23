from django.urls import path
from apps.maintenance.views.overview_views import (
    MaintenanceKPIView, MaintenanceReasonsView, MaintenanceDetailView,
    OEETrendView, DowntimeByMonthView, OEELiveView,
)
from apps.maintenance.views.work_requests_views import WorkRequestsDashboardView
from apps.maintenance.views.ca_views import (
    CorrectiveActionListCreateView,
    CorrectiveActionDetailView,
    CorrectiveActionCommentView,
    CorrectiveActionMetricsView,
    EquipmentCatalogView,
    AssigneeCatalogView,
)

urlpatterns = [
    path("overview/kpis/",                        MaintenanceKPIView.as_view()),
    path("overview/reasons/",                     MaintenanceReasonsView.as_view()),
    path("overview/detail/",                      MaintenanceDetailView.as_view()),
    path("overview/oee-trend/",                   OEETrendView.as_view()),
    path("overview/downtime-by-month/",           DowntimeByMonthView.as_view()),
    path("overview/oee-live/",                    OEELiveView.as_view()),
    path("work-requests/dashboard/",              WorkRequestsDashboardView.as_view()),
    path("corrective-actions/",                   CorrectiveActionListCreateView.as_view()),
    path("corrective-actions/<int:pk>/",          CorrectiveActionDetailView.as_view()),
    path("corrective-actions/<int:pk>/comments/", CorrectiveActionCommentView.as_view()),
    path("corrective-actions/metrics/",           CorrectiveActionMetricsView.as_view()),
    path("equipment-catalog/",                    EquipmentCatalogView.as_view()),
    path("assignee-catalog/",                     AssigneeCatalogView.as_view()),
]