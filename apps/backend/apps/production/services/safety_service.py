from datetime import date
from rest_framework.exceptions import NotFound
from apps.production.repositories.safety_repository import SafetyRepository


class SafetyService:

    @staticmethod
    def get_settings(plant: str = "Tijuana"):
        return SafetyRepository.get_settings(plant)

    @staticmethod
    def update_settings(plant: str, data: dict, user):
        if "last_incident_date" in data and data["last_incident_date"]:
            incident_date = data["last_incident_date"]
            if isinstance(incident_date, str):
                from datetime import datetime
                incident_date = datetime.strptime(incident_date, "%Y-%m-%d").date()
            days = (date.today() - incident_date).days
            data["days_without_incident"] = max(0, days)
        return SafetyRepository.update_settings(plant, data, user)

    @staticmethod
    def list_incidents(filters: dict):
        return SafetyRepository.list_incidents(filters)

    @staticmethod
    def create_incident(data: dict, user):
        return SafetyRepository.create_incident(data, user)

    @staticmethod
    def update_incident(pk: int, data: dict):
        incident = SafetyRepository.get_incident(pk)
        if not incident:
            raise NotFound(f"Incident {pk} not found.")
        return SafetyRepository.update_incident(incident, data)