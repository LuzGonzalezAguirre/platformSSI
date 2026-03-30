from rest_framework import status
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.permissions.models import Permission, Role, Module, Action
from apps.permissions.services import PermissionService
from apps.identity.repositories import UserRepository


class PermissionChoicesView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        permissions = Permission.objects.all().order_by("module", "action")
        return Response([
            {"key": p.key, "module": p.module, "action": p.action, "description": p.description}
            for p in permissions
        ])


class RoleListCreateView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        roles = Role.objects.prefetch_related("role_permissions__permission").all()
        return Response([
            {
                "id": r.id,
                "name": r.name,
                "slug": r.slug,
                "description": r.description,
                "is_system": r.is_system,
                "permissions": list(
                    r.role_permissions.values_list("permission__key", flat=True)
                ),
                "user_count": r.user_roles.count(),
            }
            for r in roles
        ])

    def post(self, request):
        name = request.data.get("name", "").strip()
        slug = request.data.get("slug", "").strip()
        description = request.data.get("description", "").strip()
        permission_keys = request.data.get("permissions", [])

        if not name or not slug:
            return Response(
                {"detail": "name y slug son obligatorios."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        if Role.objects.filter(slug=slug).exists():
            return Response(
                {"detail": "Ya existe un rol con ese slug."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        role = Role.objects.create(
            name=name, slug=slug,
            description=description, is_system=False,
        )
        PermissionService.set_role_permissions(slug, permission_keys)
        return Response({"id": role.id, "slug": role.slug}, status=status.HTTP_201_CREATED)


class RoleDetailView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request, slug: str):
        try:
            role = Role.objects.prefetch_related("role_permissions__permission").get(slug=slug)
        except Role.DoesNotExist:
            return Response({"detail": "Rol no encontrado."}, status=status.HTTP_404_NOT_FOUND)

        return Response({
            "id": role.id,
            "name": role.name,
            "slug": role.slug,
            "description": role.description,
            "is_system": role.is_system,
            "permissions": list(
                role.role_permissions.values_list("permission__key", flat=True)
            ),
            "user_count": role.user_roles.count(),
        })

    def put(self, request, slug: str):
        try:
            role = Role.objects.get(slug=slug)
        except Role.DoesNotExist:
            return Response({"detail": "Rol no encontrado."}, status=status.HTTP_404_NOT_FOUND)

        if "permissions" in request.data:
            PermissionService.set_role_permissions(slug, request.data["permissions"])

        if not role.is_system:
            role.name = request.data.get("name", role.name)
            role.description = request.data.get("description", role.description)
            role.save()

        return Response({"detail": "Rol actualizado correctamente."})

    def delete(self, request, slug: str):
        try:
            role = Role.objects.get(slug=slug)
        except Role.DoesNotExist:
            return Response({"detail": "Rol no encontrado."}, status=status.HTTP_404_NOT_FOUND)

        if role.is_system:
            return Response(
                {"detail": "Los roles de sistema no pueden eliminarse."},
                status=status.HTTP_403_FORBIDDEN,
            )
        role.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)


class UserPermissionsView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request, user_id: int):
        user = UserRepository.get_by_id(user_id)
        if not user:
            return Response({"detail": "Usuario no encontrado."}, status=status.HTTP_404_NOT_FOUND)

        return Response({
            "permissions": PermissionService.get_user_permissions(user),
            "roles": list(user.roles.values("id", "name", "slug")),
            "overrides": list(
                user.permission_overrides.values(
                    "id", "permission__key", "override_type"
                )
            ),
        })

    def post(self, request, user_id: int):
        user = UserRepository.get_by_id(user_id)
        if not user:
            return Response({"detail": "Usuario no encontrado."}, status=status.HTTP_404_NOT_FOUND)

        action = request.data.get("action")

        if action == "set_roles":
            role_slugs = request.data.get("roles", [])
            PermissionService.set_user_roles(user, role_slugs)
            return Response({"detail": "Roles asignados correctamente."})

        if action == "set_override":
            key = request.data.get("permission_key")
            override_type = request.data.get("override_type")
            if not key or not override_type:
                return Response(
                    {"detail": "permission_key y override_type son obligatorios."},
                    status=status.HTTP_400_BAD_REQUEST,
                )
            PermissionService.set_user_override(user, key, override_type)
            return Response({"detail": "Override aplicado correctamente."})

        if action == "remove_override":
            key = request.data.get("permission_key")
            if not key:
                return Response(
                    {"detail": "permission_key es obligatorio."},
                    status=status.HTTP_400_BAD_REQUEST,
                )
            PermissionService.remove_user_override(user, key)
            return Response({"detail": "Override eliminado correctamente."})

        return Response(
            {"detail": "Acción no válida. Usa: set_roles, set_override, remove_override."},
            status=status.HTTP_400_BAD_REQUEST,
        )


class MyPermissionsView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        return Response(PermissionService.get_user_permissions(request.user))