from datetime import date, timedelta

from django.http import HttpResponse
from rest_framework.views import APIView
from rest_framework.permissions import IsAuthenticated

from ..services.report_service import generate_attendance_pdf, generate_attendance_excel


class AttendancePdfView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        start_str = request.query_params.get("start_date")
        end_str = request.query_params.get("end_date")
        turno = request.query_params.get("turno") or None
        department = request.query_params.get("department") or None
        emp_id = request.query_params.get("employee_id") or None

        try:
            start_date = date.fromisoformat(start_str) if start_str else date.today() - timedelta(days=7)
            end_date = date.fromisoformat(end_str) if end_str else date.today()
            employee_id = int(emp_id) if emp_id else None
        except ValueError:
            return HttpResponse("Parámetros inválidos.", status=400, content_type="text/plain")

        generated_by = getattr(request.user, "full_name", None) or request.user.username
        pdf_bytes = generate_attendance_pdf(start_date, end_date, turno, department, employee_id, generated_by)

        filename = f"asistencia_{start_date}_{end_date}.pdf"
        response = HttpResponse(pdf_bytes, content_type="application/pdf")
        response["Content-Disposition"] = f'attachment; filename="{filename}"'
        return response


class AttendanceExcelView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        start_str = request.query_params.get("start_date")
        end_str = request.query_params.get("end_date")
        turno = request.query_params.get("turno") or None
        department = request.query_params.get("department") or None
        emp_id = request.query_params.get("employee_id") or None

        try:
            start_date = date.fromisoformat(start_str) if start_str else date.today() - timedelta(days=7)
            end_date = date.fromisoformat(end_str) if end_str else date.today()
            employee_id = int(emp_id) if emp_id else None
        except ValueError:
            return HttpResponse("Parámetros inválidos.", status=400, content_type="text/plain")

        excel_bytes = generate_attendance_excel(start_date, end_date, turno, department, employee_id)
        filename = f"asistencia_{start_date}_{end_date}.xlsx"
        response = HttpResponse(
            excel_bytes,
            content_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        )
        response["Content-Disposition"] = f'attachment; filename="{filename}"'
        return response
