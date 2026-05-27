from datetime import date, timedelta

from django.http import HttpResponse
from rest_framework.views import APIView
from rest_framework.permissions import IsAuthenticated

from ..services.pdf_service import generate_pdf


class ChairPdfReportView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        start_str = request.query_params.get("start_date")
        end_str = request.query_params.get("end_date")
        turno = request.query_params.get("turno") or None
        department = request.query_params.get("department") or None

        try:
            start_date = date.fromisoformat(start_str) if start_str else date.today() - timedelta(days=30)
            end_date = date.fromisoformat(end_str) if end_str else date.today()
        except ValueError:
            return HttpResponse("Formato de fecha inválido.", status=400, content_type="text/plain")

        generated_by = getattr(request.user, "full_name", None) or request.user.username
        pdf_bytes = generate_pdf(start_date, end_date, turno, department, generated_by)

        filename = f"reporte_leysilla_{start_date}_{end_date}.pdf"
        response = HttpResponse(pdf_bytes, content_type="application/pdf")
        response["Content-Disposition"] = f'attachment; filename="{filename}"'
        return response
