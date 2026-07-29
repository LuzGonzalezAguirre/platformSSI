# apps/quality/views/downtime_assignment_views.py
from datetime import date as date_cls

from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated

from apps.quality.models.downtime_workcenter_assignment import DowntimeWorkcenterAssignment
from apps.quality.serializers import (
    DowntimeAssignmentRowSerializer,
    DowntimeAssignmentsBulkWriteSerializer,
)
from apps.quality.services import downtime_workcenter_service


class DowntimeAssignmentsView(APIView):
    """
    GET  ?date=YYYY-MM-DD  → todos los workcenters activos + su inspector
                              asignado ese día (null si no se ha asignado).
    PUT  {date, assignments: [...]} → guarda/actualiza TODAS las filas de
                              ese día de un jalón. Sin restricción de fecha
                              — se puede editar cualquier día, pasado o
                              futuro, tantas veces como se quiera.
    """
    permission_classes = [IsAuthenticated]

    def get(self, request):
        date_str = request.query_params.get("date")
        if not date_str:
            return Response({"error": "date es obligatorio (YYYY-MM-DD)."}, status=400)
        try:
            target_date = date_cls.fromisoformat(date_str)
        except ValueError:
            return Response({"error": "Formato de date inválido."}, status=400)

        workcenters = downtime_workcenter_service.list_active_workcenters()
        existing = {
            a.workcenter_id: a
            for a in DowntimeWorkcenterAssignment.objects.filter(date=target_date)
        }

        rows = []
        for wc in workcenters:
            a = existing.get(wc.id)
            rows.append({
                "workcenter_id": wc.id,
                "workcenter_name": wc.name,
                "date": date_str,
                "inspector_user_id": a.inspector_user_id if a else None,
                "inspector_name": a.inspector_name if a else None,
            })

        serializer = DowntimeAssignmentRowSerializer(rows, many=True)
        return Response({"date": date_str, "results": serializer.data})

    def put(self, request):
        serializer = DowntimeAssignmentsBulkWriteSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        target_date = serializer.validated_data["date"]
        items = serializer.validated_data["assignments"]

        user = request.user if request.user.is_authenticated else None
        saved_ids = []
        for item in items:
            obj, _ = DowntimeWorkcenterAssignment.objects.update_or_create(
                workcenter_id=item["workcenter_id"],
                date=target_date,
                defaults={
                    "inspector_user_id": item.get("inspector_user_id"),
                    "inspector_name": item.get("inspector_name"),
                    "updated_by": user,
                },
            )
            saved_ids.append(obj.id)

        return Response({"date": target_date.isoformat(), "saved": len(saved_ids)})