from django.urls import path
from apps.production.views.targets_views import (
    BusinessUnitListView, WeeklyTargetView, WeeklyWIPView,
)
from apps.production.views.safety_views import (
    SafetySettingsView, SafetyIncidentListCreateView, SafetyIncidentUpdateView,
)
from apps.production.views.assistance_views import (
    PlantEmployeeListCreateView, PlantEmployeeDetailView, AttendanceView,
)

urlpatterns = [
    path("business-units/",              BusinessUnitListView.as_view()),
    path("targets/weekly/",              WeeklyTargetView.as_view()),
    path("wip/weekly/",                  WeeklyWIPView.as_view()),
    path("safety/settings/",             SafetySettingsView.as_view()),
    path("safety/incidents/",            SafetyIncidentListCreateView.as_view()),
    path("safety/incidents/<int:pk>/",   SafetyIncidentUpdateView.as_view()),
    path("employees/",                   PlantEmployeeListCreateView.as_view()),
    path("employees/<int:pk>/",          PlantEmployeeDetailView.as_view()),
    path("attendance/",                  AttendanceView.as_view()),
]