# apps/quality/services/incoming_inspection_sla_config_service.py
from rest_framework.exceptions import PermissionDenied, ValidationError

from apps.quality.models import IncomingInspectionSLAConfig

WRITE_ROLES = {"admin", "ingeniero"}

MIN_THRESHOLD_HOURS = 1
MAX_THRESHOLD_HOURS = 500


def _check_write(user):
    user_roles = set(
        user.user_roles.select_related("role").values_list("role__slug", flat=True)
    )
    if not user_roles.intersection(WRITE_ROLES):
        raise PermissionDenied("No tienes permisos para modificar el umbral de SLA de Incoming Inspection.")


def get_current_threshold() -> int:
    latest = IncomingInspectionSLAConfig.objects.order_by("-updated_at").first()
    return latest.threshold_hours if latest else 48


def update_threshold(new_value: int, user) -> IncomingInspectionSLAConfig:
    _check_write(user)
    if not (MIN_THRESHOLD_HOURS <= new_value <= MAX_THRESHOLD_HOURS):
        raise ValidationError(f"threshold_hours debe estar entre {MIN_THRESHOLD_HOURS} y {MAX_THRESHOLD_HOURS}.")

    previous = get_current_threshold()
    return IncomingInspectionSLAConfig.objects.create(
        threshold_hours=new_value,
        previous_value=previous,
        updated_by=user,
    )
