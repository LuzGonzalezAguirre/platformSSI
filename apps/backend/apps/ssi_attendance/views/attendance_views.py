from datetime import date, timedelta

from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated

from ..services.attendance_service import AttendanceService


class AttendanceKpiView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        start_str = request.query_params.get("start_date")
        end_str = request.query_params.get("end_date")
        turno = request.query_params.get("turno") or None
        department = request.query_params.get("department") or None

        try:
            start_date = date.fromisoformat(start_str) if start_str else date.today() - timedelta(days=7)
            end_date = date.fromisoformat(end_str) if end_str else date.today()
        except ValueError:
            return Response({"error": "Formato de fecha inválido."}, status=400)

        data = AttendanceService.get_kpis(start_date, end_date, turno, department)
        return Response(data)


class AttendanceListView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        start_str = request.query_params.get("start_date")
        end_str = request.query_params.get("end_date")
        turno = request.query_params.get("turno") or None
        department = request.query_params.get("department") or None
        emp_id = request.query_params.get("employee_id") or None

        try:
            page = max(1, int(request.query_params.get("page", 1)))
            page_size = min(100, max(1, int(request.query_params.get("page_size", 20))))
            start_date = date.fromisoformat(start_str) if start_str else date.today() - timedelta(days=7)
            end_date = date.fromisoformat(end_str) if end_str else date.today()
            employee_id = int(emp_id) if emp_id else None
        except ValueError:
            return Response({"error": "Parámetros inválidos."}, status=400)

        data = AttendanceService.get_records(
            start_date, end_date, turno, department, employee_id, page, page_size
        )
        return Response(data)


class EmployeeListView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        department = request.query_params.get("department") or None
        employees = AttendanceService.get_employees(department)
        return Response(employees)


class DepartmentListView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        departments = AttendanceService.get_departments()
        return Response(departments)
