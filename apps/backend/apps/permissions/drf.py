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