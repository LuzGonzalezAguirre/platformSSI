from django.urls import path
from apps.permissions.drf import production_view
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
    path("business-units/",              production_view(BusinessUnitListView)),
    path("targets/weekly/",              production_view(WeeklyTargetView, {"GET": "view", "POST": "edit"})),
    path("wip/weekly/",                  production_view(WeeklyWIPView, {"GET": "view", "POST": "edit"})),
    path("safety/settings/",             production_view(SafetySettingsView, {"GET": "view", "PATCH": "edit"})),
    path("safety/incidents/",            production_view(SafetyIncidentListCreateView, {"GET": "view", "POST": "create"})),
    path("safety/incidents/<int:pk>/",   production_view(SafetyIncidentUpdateView, {"PATCH": "edit"})),
    path("employees/",                   production_view(PlantEmployeeListCreateView)),
    path("employees/<int:pk>/",          production_view(PlantEmployeeDetailView)),
    path("attendance/",                  production_view(AttendanceView, {"GET": "view", "POST": "edit"})),
    path("ops/daily-summary/", production_view(OpsDailySummaryView)),
    path("ops/weekly-table/", production_view(OpsWeeklyTableView)),
    path("earned-hours/", production_view(EarnedHoursView, {"GET": "view", "POST": "edit", "DELETE": "delete"})),
    path("ops/oee/", production_view(OEERecordView, {"GET": "view", "POST": "edit"})),
    path("ops/export/daily/", production_view(OpsDailyExportView)),
    path("ops/export/pdf/", production_view(OpsDailyPDFExportView)),
    path("employees/<int:pk>/reactivate/", production_view(PlantEmployeeReactivateView, {"POST": "edit"})),

    # CCS — Barcode attendance
    path("ccs/check-in/",         production_view(CcsCheckInView, {"POST": "create"})),
    path("ccs/check-out/",        production_view(CcsCheckOutView, {"POST": "create"})),
    path("ccs/overtime/",         production_view(CcsOvertimeView, {"POST": "create"})),
    path("ccs/today-status/",     production_view(CcsTodayStatusView)),
    path("ccs/attendance/daily/",   production_view(CcsAttendanceDailyView, {"GET": "view", "POST": "edit"})),
    path("ccs/attendance/records/", production_view(CcsAttendanceRecordsView, {"POST": "view"})),
    path("ccs/attendance/kpis/",    production_view(CcsAttendanceKpisView, {"POST": "view"})),
    path("ccs/employees/",           production_view(CcsEmployeesView)),
    path("ccs/employees/<int:pk>/",  production_view(CcsEmployeeDetailView)),
    path("ccs/employees/<int:pk>/reactivate/", production_view(CcsEmployeeReactivateView, {"POST": "edit"})),

    # Chairs (Ley Silla NOM-036)
    path("chairs/kpis/",         production_view(ChairKpisView, {"POST": "view"})),
    path("chairs/breaks/",       production_view(ChairBreaksView, {"POST": "view"})),
    path("chairs/daily-chart/",  production_view(ChairDailyChartView, {"POST": "view"})),
    path("chairs/turno-chart/",  production_view(ChairTurnoChartView, {"POST": "view"})),

    path("productivity/daily/", production_view(DailyProductivityView)),
    path("safety/counter-history/", production_view(SafetyCounterHistoryView)),
]