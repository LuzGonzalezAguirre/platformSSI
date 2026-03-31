from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status
from rest_framework.permissions import IsAuthenticated
from apps.production.services.safety_service import SafetyService
from apps.production.serializers.safety import (
    SafetySettingsSerializer, SafetySettingsUpdateSerializer,
    SafetyIncidentSerializer, SafetyIncidentCreateSerializer,
    SafetyIncidentUpdateSerializer,
)


class SafetySettingsView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        plant = request.query_params.get("plant", "Tijuana")
        obj   = SafetyService.get_settings(plant)
        return Response(SafetySettingsSerializer(obj).data)

    def patch(self, request):
        plant = request.query_params.get("plant", "Tijuana")
        serializer = SafetySettingsUpdateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        obj = SafetyService.update_settings(plant, serializer.validated_data, request.user)
        return Response(SafetySettingsSerializer(obj).data)


class SafetyIncidentListCreateView(APIView):
    permission_classes = [IsAuthenticated]

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
        return Response(SafetyIncidentSerializer(incident).data, status=status.HTTP_201_CREATED)


class SafetyIncidentUpdateView(APIView):
    permission_classes = [IsAuthenticated]

    def patch(self, request, pk: int):
        serializer = SafetyIncidentUpdateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        incident = SafetyService.update_incident(pk, serializer.validated_data)
        return Response(SafetyIncidentSerializer(incident).data)