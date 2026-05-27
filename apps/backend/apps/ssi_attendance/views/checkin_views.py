from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated

from ..services.checkin_service import CheckInService


class CheckInView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request):
        barcode_id = request.data.get("barcode_id", "").strip()
        if not barcode_id:
            return Response({"error": "barcode_id es requerido."}, status=400)

        employee = CheckInService.get_employee_by_barcode(barcode_id)
        if not employee:
            return Response({"error": f"Empleado no encontrado o inactivo: {barcode_id}"}, status=404)

        try:
            result = CheckInService.register_check_in(barcode_id)
            return Response({"success": True, "employee": employee, **result})
        except Exception as exc:
            return Response({"error": str(exc)}, status=400)


class CheckOutView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request):
        barcode_id = request.data.get("barcode_id", "").strip()
        if not barcode_id:
            return Response({"error": "barcode_id es requerido."}, status=400)

        employee = CheckInService.get_employee_by_barcode(barcode_id)
        if not employee:
            return Response({"error": f"Empleado no encontrado o inactivo: {barcode_id}"}, status=404)

        try:
            result = CheckInService.register_check_out(barcode_id)
            return Response({"success": True, "employee": employee, **result})
        except Exception as exc:
            return Response({"error": str(exc)}, status=400)


class OvertimeView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request):
        employee_id = request.data.get("employee_id")
        overtime_date = request.data.get("overtime_date")
        if not employee_id or not overtime_date:
            return Response({"error": "employee_id y overtime_date son requeridos."}, status=400)

        try:
            result = CheckInService.register_overtime(int(employee_id), overtime_date)
            return Response({"success": True, **result})
        except Exception as exc:
            return Response({"error": str(exc)}, status=400)


class TodayStatusView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        barcode_id = request.query_params.get("barcode_id", "").strip()
        if not barcode_id:
            return Response({"error": "barcode_id es requerido."}, status=400)

        status = CheckInService.get_today_status(barcode_id)
        if status is None:
            return Response({"checked_in": False, "checked_out": False})
        return Response({
            "checked_in": status.get("check_in") is not None,
            "checked_out": status.get("check_out") is not None,
            **status,
        })
