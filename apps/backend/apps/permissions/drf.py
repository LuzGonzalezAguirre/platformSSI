from rest_framework.permissions import BasePermission

from apps.permissions.services import PermissionService

SAFE_METHODS = frozenset({"GET", "HEAD", "OPTIONS"})


class HasModulePermission(BasePermission):
    """
    Resuelve module.action contra el catálogo de permisos.
    Subclasear con module / read_action / write_action, o usar module_permission().
    """

    module: str = ""
    read_action: str = "view"
    write_action: str = "edit"

    def has_permission(self, request, view) -> bool:
        user = getattr(request, "user", None)
        if not user or not user.is_authenticated:
            return False
        action = self.read_action if request.method in SAFE_METHODS else self.write_action
        return PermissionService.has_permission(user, self.module, action)


def module_permission(module: str, write_action: str = "edit", read_action: str = "view"):
    return type(
        f"HasPermission_{module}_{write_action}",
        (HasModulePermission,),
        {"module": module, "write_action": write_action, "read_action": read_action},
    )

class HasMappedModulePermission(BasePermission):
    """
    Autoriza cada método HTTP mediante un mapa explícito definido por la vista.

    La vista debe declarar:
        permission_module = "administration"
        permission_action_map = {"GET": "view", "POST": "create"}

    Si un método no está mapeado, se deniega por defecto.
    """

    def has_permission(self, request, view) -> bool:
        user = getattr(request, "user", None)
        if not user or not user.is_authenticated:
            return False

        module = getattr(view, "permission_module", "")
        action_map = getattr(view, "permission_action_map", {})
        action = action_map.get(request.method)

        if not module or not action:
            return False

        return PermissionService.has_permission(user, module, action)


DEFAULT_QUALITY_ACTION_MAP = {
    "GET": "view",
    "HEAD": "view",
    "OPTIONS": "view",
    "POST": "create",
    "PUT": "edit",
    "PATCH": "edit",
    "DELETE": "delete",
}


class QualityModulePermission(BasePermission):
    """Política RBAC común para el dominio Quality."""

    def has_permission(self, request, view) -> bool:
        user = getattr(request, "user", None)
        if not user or not user.is_authenticated:
            return False

        action_map = getattr(
            view,
            "quality_action_map",
            DEFAULT_QUALITY_ACTION_MAP,
        )
        action = action_map.get(request.method)
        if not action:
            return False

        return PermissionService.has_permission(user, "quality", action)


def quality_view(view_class, action_map=None):
    """
    Registra una APIView del dominio Quality con la política RBAC común.

    action_map permite documentar excepciones semánticas donde el verbo HTTP
    no representa CRUD directo.
    """
    view_class.permission_classes = [QualityModulePermission]
    if action_map is not None:
        view_class.quality_action_map = action_map
    return view_class.as_view()
