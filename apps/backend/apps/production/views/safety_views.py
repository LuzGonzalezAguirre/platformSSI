from rest_framework import status
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.permissions.drf import module_permission
from apps.production.serializers.safety import (
    SafetySettingsSerializer, SafetySettingsUpdateSerializer,
    SafetyIncidentSerializer, SafetyIncidentCreateSerializer,
    SafetyIncidentUpdateSerializer, SafetyCounterEventSerializer,
)
from apps.production.services.safety_service import SafetyService

ProductionRead   = module_permission("production", write_action="view")
ProductionCreate = module_permission("production", write_action="create")
ProductionEdit   = module_permission("production", write_action="edit")


class SafetySettingsView(APIView):
    permission_classes = [ProductionEdit]

    def get(self, request):
        obj = SafetyService.get_settings(request.query_params.get("plant", "Tijuana"))
        return Response(SafetySettingsSerializer(obj).data)

    def patch(self, request):
        serializer = SafetySettingsUpdateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        obj = SafetyService.update_settings(
            request.query_params.get("plant", "Tijuana"),
            serializer.validated_data,
            request.user,
        )
        return Response(SafetySettingsSerializer(obj).data)


class SafetyIncidentListCreateView(APIView):
    permission_classes = [ProductionCreate]

    def get(self, request):
        filters = {
            "incident_type": request.query_params.get("type"),
            "status":        request.query_params.get("status"),
            "severity":      request.query_params.get("severity"),
            "date_from":     request.query_params.get("date_from"),
            "date_to":       request.query_params.get("date_to"),
        }
        incidents = SafetyService.list_incidents(filters)
        return Response(SafetyIncidentSerializer(incidents, many=True).data)

    def post(self, request):
        serializer = SafetyIncidentCreateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        incident = SafetyService.create_incident(serializer.validated_data, request.user)
        return Response(
            SafetyIncidentSerializer(incident).data,
            status=status.HTTP_201_CREATED,
        )


class SafetyIncidentUpdateView(APIView):
    permission_classes = [ProductionEdit]

    def patch(self, request, pk: int):
        serializer = SafetyIncidentUpdateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        incident = SafetyService.update_incident(pk, serializer.validated_data)
        return Response(SafetyIncidentSerializer(incident).data)


class SafetyCounterHistoryView(APIView):
    permission_classes = [ProductionRead]

    def get(self, request):
        events = SafetyService.list_counter_events(
            request.query_params.get("plant", "Tijuana")
        )
        return Response(SafetyCounterEventSerializer(events, many=True).data)