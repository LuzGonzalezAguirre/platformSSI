# apps/quality/views/downtime_assignment_views.py
from datetime import date as date_cls

from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.quality.serializers import (
    DowntimeAssignmentGroupNodeSerializer,
    DowntimeAssignmentsBulkWriteSerializer,
)
from apps.quality.services import downtime_assignment_service
from apps.quality.services.downtime_assignment_resolver import INHERITANCE_LOOKBACK_DAYS


class DowntimeAssignmentsView(APIView):
    """
    GET  ?date=YYYY-MM-DD
        Árbol group → subgroup → workcenters con el inspector efectivo en
        cada nivel. Incluye herencia del día anterior (hasta
        INHERITANCE_LOOKBACK_DAYS): los valores heredados vienen con
        `inherited_from` poblado para que la UI los distinga de los
        confirmados. Nada se persiste al leer.

    PUT  {date, groups: [...], overrides: [...]}
        REPLACE-SET por día: lo que no venga se borra para esa fecha.
        Guardar materializa lo heredado como decisión explícita del día.

    ⚠️ RBAC pendiente: el PUT debería exigir
       admin | quality_engineer | supervisor
       vía user.roles.values_list("role__slug", flat=True).
       Hoy cualquier usuario autenticado puede reasignar toda la planta.
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

        tree = downtime_assignment_service.build_assignment_tree(target_date)
        serializer = DowntimeAssignmentGroupNodeSerializer(tree, many=True)
        return Response({
            "date": date_str,
            "inheritance_lookback_days": INHERITANCE_LOOKBACK_DAYS,
            "groups": serializer.data,
        })

    def put(self, request):
        serializer = DowntimeAssignmentsBulkWriteSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        user = request.user if request.user.is_authenticated else None
        try:
            result = downtime_assignment_service.save_assignments(
                target_date=serializer.validated_data["date"],
                groups=serializer.validated_data["groups"],
                overrides=serializer.validated_data["overrides"],
                user=user,
            )
        except downtime_assignment_service.DowntimeAssignmentError as exc:
            return Response({"error": str(exc)}, status=400)

        return Response(result)