from django.urls import path
from apps.production.views.targets_views import (
    BusinessUnitListView, WeeklyTargetView, WeeklyWIPView,OEERecordView,
)
from apps.production.views.safety_views import (
    SafetySettingsView, SafetyIncidentListCreateView, SafetyIncidentUpdateView,SafetyCounterHistoryView,
)
from apps.production.views.assistance_views import (
    PlantEmployeeListCreateView, PlantEmployeeDetailView,
    AttendanceView, EarnedHoursView,
    PlantEmployeeReactivateView,
)
from apps.production.views.ccs_views import (
    CcsCheckInView, CcsCheckOutView, CcsOvertimeView, CcsTodayStatusView,
    CcsAttendanceRecordsView, CcsAttendanceKpisView, CcsAttendanceDailyView,
    CcsEmployeesView, CcsEmployeeDetailView,CcsEmployeeReactivateView,
    ChairKpisView, ChairBreaksView, ChairDailyChartView, ChairTurnoChartView,
)
from apps.production.views.ops_report_views import OpsDailySummaryView, OpsWeeklyTableView
from apps.production.views.ops_report_views import OpsDailyExportView
from apps.production.views.ops_report_views import OpsDailyPDFExportView

from apps.production.views.productivity_views import DailyProductivityView


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
    path("employees/<int:pk>/reactivate/", PlantEmployeeReactivateView.as_view()),

    # CCS — Barcode attendance
    path("ccs/check-in/",         CcsCheckInView.as_view()),
    path("ccs/check-out/",        CcsCheckOutView.as_view()),
    path("ccs/overtime/",         CcsOvertimeView.as_view()),
    path("ccs/today-status/",     CcsTodayStatusView.as_view()),
    path("ccs/attendance/daily/",   CcsAttendanceDailyView.as_view()),
    path("ccs/attendance/records/", CcsAttendanceRecordsView.as_view()),
    path("ccs/attendance/kpis/",    CcsAttendanceKpisView.as_view()),
    path("ccs/employees/",           CcsEmployeesView.as_view()),
    path("ccs/employees/<int:pk>/",  CcsEmployeeDetailView.as_view()),
    path("ccs/employees/<int:pk>/reactivate/", CcsEmployeeReactivateView.as_view()),

    # Chairs (Ley Silla NOM-036)
    path("chairs/kpis/",         ChairKpisView.as_view()),
    path("chairs/breaks/",       ChairBreaksView.as_view()),
    path("chairs/daily-chart/",  ChairDailyChartView.as_view()),
    path("chairs/turno-chart/",  ChairTurnoChartView.as_view()),

    path("productivity/daily/", DailyProductivityView.as_view()),
    path("safety/counter-history/", SafetyCounterHistoryView.as_view()),
]