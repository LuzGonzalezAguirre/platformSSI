from django.db.models import QuerySet

from apps.production.models import SafetySettings, SafetyIncident, SafetyCounterEvent

SETTINGS_WRITABLE_FIELDS = frozenset({"last_incident_date", "baseline_date"})


class SafetyRepository:

    @staticmethod
    def get_settings(plant: str) -> SafetySettings:
        obj, _ = SafetySettings.objects.get_or_create(plant=plant)
        return obj

    @staticmethod
    def get_settings_for_update(plant: str) -> SafetySettings:
        """Debe llamarse dentro de transaction.atomic()."""
        SafetyRepository.get_settings(plant)
        return SafetySettings.objects.select_for_update().get(plant=plant)

    @staticmethod
    def save_settings(obj: SafetySettings, data: dict, user) -> SafetySettings:
        update_fields = ["updated_by", "updated_at"]
        for field, value in data.items():
            if field not in SETTINGS_WRITABLE_FIELDS:
                continue
            setattr(obj, field, value)
            update_fields.append(field)
        obj.updated_by = user
        obj.save(update_fields=update_fields)
        return obj

    @staticmethod
    def log_counter_event(
        settings_obj: SafetySettings,
        source: str,
        previous_incident_date,
        new_incident_date,
        previous_days: int,
        reason: str,
        user,
        incident: SafetyIncident | None = None,
    ) -> SafetyCounterEvent:
        return SafetyCounterEvent.objects.create(
            settings=settings_obj,
            source=source,
            incident=incident,
            previous_incident_date=previous_incident_date,
            new_incident_date=new_incident_date,
            previous_days=previous_days,
            reason=reason,
            created_by=user,
        )

    @staticmethod
    def list_counter_events(settings_obj: SafetySettings, limit: int = 50) -> QuerySet:
        return (
            settings_obj.counter_events
            .select_related("created_by", "incident")
            .all()[:limit]
        )

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
        return SafetyIncident.objects.filter(pk=pk).first()

    @staticmethod
    def update_incident(incident: SafetyIncident, data: dict) -> SafetyIncident:
        for field, value in data.items():
            setattr(incident, field, value)
        incident.save()
        return incident