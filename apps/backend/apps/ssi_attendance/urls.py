from django.urls import path
from .views.checkin_views import CheckInView, CheckOutView, OvertimeView, TodayStatusView
from .views.attendance_views import AttendanceKpiView, AttendanceListView, EmployeeListView, DepartmentListView
from .views.report_views import AttendancePdfView, AttendanceExcelView

urlpatterns = [
    # Check-in / Check-out
    path("check-in/",      CheckInView.as_view(),    name="ssi-attendance-checkin"),
    path("check-out/",     CheckOutView.as_view(),   name="ssi-attendance-checkout"),
    path("overtime/",      OvertimeView.as_view(),   name="ssi-attendance-overtime"),
    path("today-status/",  TodayStatusView.as_view(), name="ssi-attendance-today"),

    # Dashboard
    path("kpis/",        AttendanceKpiView.as_view(),  name="ssi-attendance-kpis"),
    path("records/",     AttendanceListView.as_view(), name="ssi-attendance-list"),
    path("employees/",   EmployeeListView.as_view(),   name="ssi-attendance-employees"),
    path("departments/", DepartmentListView.as_view(), name="ssi-attendance-departments"),

    # Reports
    path("pdf/",   AttendancePdfView.as_view(),   name="ssi-attendance-pdf"),
    path("excel/", AttendanceExcelView.as_view(), name="ssi-attendance-excel"),
]
