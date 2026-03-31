from django.db.models import QuerySet
from apps.production.models import SafetySettings, SafetyIncident


class SafetyRepository:

    @staticmethod
    def get_settings(plant: str = "Tijuana") -> SafetySettings:
        obj, _ = SafetySettings.objects.get_or_create(plant=plant)
        return obj

    @staticmethod
    def update_settings(plant: str, data: dict, user) -> SafetySettings:
        obj = SafetyRepository.get_settings(plant)
        for field, value in data.items():
            setattr(obj, field, value)
        obj.updated_by = user
        obj.save()
        return obj

    @staticmethod
    def list_incidents(filters: dict) -> QuerySet:
        qs = SafetyIncident.objects.select_related("reported_by").all()
        if filters.get("incident_type"):
            qs = qs.filter(incident_type=filters["incident_type"])
        if filters.get("status"):
            qs = qs.filter(status=filters["status"])
        if filters.get("severity"):
            qs = qs.filter(severity=filters["severity"])
        if filters.get("date_from"):
            qs = qs.filter(incident_date__gte=filters["date_from"])
        if filters.get("date_to"):
            qs = qs.filter(incident_date__lte=filters["date_to"])
        return qs

    @staticmethod
    def create_incident(data: dict, user) -> SafetyIncident:
        return SafetyIncident.objects.create(**data, reported_by=user)

    @staticmethod
    def get_incident(pk: int) -> SafetyIncident | None:
        try:
            return SafetyIncident.objects.get(pk=pk)
        except SafetyIncident.DoesNotExist:
            return None

    @staticmethod
    def update_incident(incident: SafetyIncident, data: dict) -> SafetyIncident:
        for field, value in data.items():
            setattr(incident, field, value)
        incident.save()
        return incident