from django.db import transaction
from rest_framework.exceptions import NotFound, ValidationError

from apps.production.models import SafetyCounterEvent, COUNTER_RESETTING_TYPES
from apps.production.repositories.safety_repository import SafetyRepository

DEFAULT_PLANT = "Tijuana"
ALLOWED_PLANTS = frozenset({"Tijuana"})


class SafetyService:

    @staticmethod
    def _validate_plant(plant: str) -> str:
        plant = (plant or DEFAULT_PLANT).strip()
        if plant not in ALLOWED_PLANTS:
            raise ValidationError({"plant": f"Planta no reconocida: '{plant}'."})
        return plant

    @staticmethod
    def get_settings(plant: str = DEFAULT_PLANT):
        return SafetyRepository.get_settings(SafetyService._validate_plant(plant))

    @staticmethod
    @transaction.atomic
    def update_settings(plant: str, data: dict, user):
        """
        Ajuste manual del ancla del contador. Siempre deja rastro en
        SafetyCounterEvent — nunca se mueve el contador en silencio.
        """
        plant = SafetyService._validate_plant(plant)
        obj = SafetyRepository.get_settings_for_update(plant)

        previous_date = obj.last_incident_date
        previous_days = obj.days_without_incident
        reason = data.pop("reason", "")

        obj = SafetyRepository.save_settings(obj, data, user)

        if "last_incident_date" in data or "baseline_date" in data:
            SafetyRepository.log_counter_event(
                settings_obj=obj,
                source=SafetyCounterEvent.Source.MANUAL,
                previous_incident_date=previous_date,
                new_incident_date=obj.last_incident_date,
                previous_days=previous_days,
                reason=reason,
                user=user,
            )
        return obj

    @staticmethod
    def list_incidents(filters: dict):
        return SafetyRepository.list_incidents(filters)

    @staticmethod
    @transaction.atomic
    def create_incident(data: dict, user, plant: str = DEFAULT_PLANT):
        """
        Registra el incidente y, si su tipo resetea el contador, mueve el
        ancla en la misma transacción. Un incidente retroactivo anterior al
        último ya registrado NO retrocede el contador.
        """
        plant = SafetyService._validate_plant(plant)
        incident = SafetyRepository.create_incident(data, user)

        if incident.incident_type not in COUNTER_RESETTING_TYPES:
            return incident

        obj = SafetyRepository.get_settings_for_update(plant)
        previous_date = obj.last_incident_date
        previous_days = obj.days_without_incident

        if previous_date and previous_date >= incident.incident_date:
            return incident

        obj = SafetyRepository.save_settings(
            obj, {"last_incident_date": incident.incident_date}, user
        )
        SafetyRepository.log_counter_event(
            settings_obj=obj,
            source=SafetyCounterEvent.Source.INCIDENT,
            previous_incident_date=previous_date,
            new_incident_date=incident.incident_date,
            previous_days=previous_days,
            reason=f"Reset automático por incidente #{incident.pk} ({incident.incident_type})",
            user=user,
            incident=incident,
        )
        return incident

    @staticmethod
    def update_incident(pk: int, data: dict):
        incident = SafetyRepository.get_incident(pk)
        if not incident:
            raise NotFound(f"Incident {pk} not found.")
        return SafetyRepository.update_incident(incident, data)

    @staticmethod
    def list_counter_events(plant: str = DEFAULT_PLANT, limit: int = 50):
        obj = SafetyService.get_settings(plant)
        return SafetyRepository.list_counter_events(obj, limit)