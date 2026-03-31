from datetime import datetime
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status
from rest_framework.permissions import IsAuthenticated
from apps.production.services.assistance_service import AssistanceService
from apps.production.serializers.assistance import (
    PlantEmployeeSerializer, PlantEmployeeCreateSerializer,
    PlantEmployeeUpdateSerializer,
    AttendanceRecordSerializer, AttendanceBulkSerializer,
)
from apps.production.models import AttendanceRecord


class PlantEmployeeListCreateView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        turno          = request.query_params.get("turno")
        include_inactive = request.query_params.get("include_inactive", "false").lower() == "true"
        employees      = AssistanceService.list_employees(turno=turno, include_inactive=include_inactive)
        return Response(PlantEmployeeSerializer(employees, many=True).data)

    def post(self, request):
        serializer = PlantEmployeeCreateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        employee = AssistanceService.create_employee(serializer.validated_data)
        return Response(PlantEmployeeSerializer(employee).data, status=status.HTTP_201_CREATED)


class PlantEmployeeDetailView(APIView):
    permission_classes = [IsAuthenticated]

    def patch(self, request, pk: int):
        serializer = PlantEmployeeUpdateSerializer(data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        employee = AssistanceService.update_employee(pk, serializer.validated_data)
        return Response(PlantEmployeeSerializer(employee).data)

    def delete(self, request, pk: int):
        employee = AssistanceService.deactivate_employee(pk)
        return Response(PlantEmployeeSerializer(employee).data)


class AttendanceView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        date_str = request.query_params.get("date")
        turno    = request.query_params.get("turno")
        try:
            attendance_date = datetime.strptime(date_str, "%Y-%m-%d").date()
        except (TypeError, ValueError):
            return Response({"detail": "Param 'date' required (YYYY-MM-DD)."}, status=400)
        records = AssistanceService.get_attendance(attendance_date, turno)
        result  = []
        for r in records:
            if isinstance(r, AttendanceRecord):
                result.append(AttendanceRecordSerializer(r).data)
            else:
                result.append({
                    "id":            None,
                    "employee_id":   r["employee"].id,
                    "employee_name": r["employee"].name,
                    "turno":         r["employee"].turno,
                    "date":          str(r["date"]),
                    "status":        r["status"],
                    "shift":         r["shift"],
                    "hours":         str(r["hours"]),
                    "recorded_at":   None,
                })
        return Response(result)

    def post(self, request):
        serializer = AttendanceBulkSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        count = AssistanceService.bulk_save_attendance(
            serializer.validated_data["records"], request.user
        )
        return Response({"saved": count})