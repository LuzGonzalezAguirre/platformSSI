from rest_framework.exceptions import NotFound, PermissionDenied, ValidationError
from apps.maintenance.repositories.ca_repository import CorrectiveActionRepository

WRITE_ROLES = {"maintenance_engineer", "supervisor", "admin", "plant_manager"}


def _check_write(user):
    user_roles = set(
        user.user_roles.select_related("role").values_list("role__slug", flat=True)
    )
    if not user_roles.intersection(WRITE_ROLES):
        raise PermissionDenied("No tienes permisos para modificar acciones correctivas.")


class CorrectiveActionService:

    @staticmethod
    def list_actions(filters: dict):
        return CorrectiveActionRepository.list_all(filters)

    @staticmethod
    def get_action(pk: int):
        obj = CorrectiveActionRepository.get(pk)
        if not obj:
            raise NotFound(f"Corrective Action {pk} not found.")
        return obj

    @staticmethod
    def create_action(data: dict, user):
        _check_write(user)
        # Etapa 1 solo — status siempre open al crear
        allowed = {"title", "description", "priority", "equipment_id", "equipment_desc", "equipment_group"}
        filtered = {k: v for k, v in data.items() if k in allowed}
        return CorrectiveActionRepository.create(filtered, user)

    @staticmethod
    def update_action(pk: int, data: dict, user):
        _check_write(user)
        obj = CorrectiveActionService.get_action(pk)

        # Validar transición de estado si viene en el payload
        new_status = data.get("status")
        if new_status and new_status != obj.status:
            if not obj.can_transition_to(new_status):
                raise ValidationError(
                    f"Transición inválida: {obj.status} → {new_status}"
                )
            # Validar cierre con evidencia
            if new_status == "closed":
                has_notes    = bool(data.get("close_notes") or obj.close_notes)
                has_comments = obj.comments.exists()
                if not has_notes and not has_comments:
                    raise ValidationError(
                        "No se puede cerrar sin evidencia. Agrega notas de cierre o un comentario."
                    )

        return CorrectiveActionRepository.update(obj, data, user)

    @staticmethod
    def delete_action(pk: int, user):
        _check_write(user)
        obj = CorrectiveActionService.get_action(pk)
        if obj.status not in ("open", "cancelled"):
            raise ValidationError("Solo se pueden eliminar acciones en estado Open o Cancelled.")
        CorrectiveActionRepository.delete(obj)

    @staticmethod
    def add_comment(pk: int, text: str, user):
        obj = CorrectiveActionService.get_action(pk)
        return CorrectiveActionRepository.add_comment(obj, text, user)