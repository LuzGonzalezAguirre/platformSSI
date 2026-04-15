from django.urls import path
from apps.production.views.targets_views import (
    BusinessUnitListView, WeeklyTargetView, WeeklyWIPView,OEERecordView,
)
from apps.production.views.safety_views import (
    SafetySettingsView, SafetyIncidentListCreateView, SafetyIncidentUpdateView,
)
from apps.production.views.assistance_views import (
    PlantEmployeeListCreateView, PlantEmployeeDetailView,
    AttendanceView, EarnedHoursView,
)
from apps.production.views.ops_report_views import OpsDailySummaryView, OpsWeeklyTableView
from apps.production.views.ops_report_views import OpsDailyExportView
from apps.production.views.ops_report_views import OpsDailyPDFExportView

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
    path("ops/daily-summary/", OpsDailySummaryView.as_view()),
    path("ops/weekly-table/", OpsWeeklyTableView.as_view()),
    path("earned-hours/", EarnedHoursView.as_view()),
    path("ops/oee/", OEERecordView.as_view()),
    path("ops/export/daily/", OpsDailyExportView.as_view()),
    path("ops/export/pdf/", OpsDailyPDFExportView.as_view()),



]