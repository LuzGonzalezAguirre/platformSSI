from rest_framework import status
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.identity.serializers import (
    UserListSerializer,
    UserCreateSerializer,
    UserUpdateSerializer,
    ResetPasswordSerializer,
)
from apps.identity.services import UserService
from apps.permissions.models import Role
from apps.permissions.services import PermissionService


class UserListCreateView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        role_slug = request.query_params.get("role")
        plant     = request.query_params.get("plant")
        search    = request.query_params.get("search")
        is_active = request.query_params.get("is_active")

        if is_active is not None:
            is_active = is_active.lower() == "true"

        users = UserService.list_users(
            role=role_slug,
            plant=plant,
            is_active=is_active if is_active is not None else None,
            search=search,
        )
        return Response(UserListSerializer(users, many=True).data)

    def post(self, request):
        role_slugs = request.data.get("roles", [])
        serializer = UserCreateSerializer(data=request.data)
        if not serializer.is_valid():
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

        try:
            user = UserService.create_user(serializer.validated_data)
        except ValueError as e:
            return Response({"detail": str(e)}, status=status.HTTP_400_BAD_REQUEST)

        if role_slugs:
            PermissionService.set_user_roles(user, role_slugs)

        return Response(UserListSerializer(user).data, status=status.HTTP_201_CREATED)


class UserDetailView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request, user_id: int):
        try:
            user = UserService.get_user(user_id)
        except ValueError as e:
            return Response({"detail": str(e)}, status=status.HTTP_404_NOT_FOUND)
        return Response(UserListSerializer(user).data)

    def patch(self, request, user_id: int):
        role_slugs = request.data.get("roles")

        try:
            user = UserService.get_user(user_id)
        except ValueError as e:
            return Response({"detail": str(e)}, status=status.HTTP_404_NOT_FOUND)

        serializer = UserUpdateSerializer(user, data=request.data, partial=True)
        if not serializer.is_valid():
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

        try:
            updated = UserService.update_user(user_id, serializer.validated_data)
        except ValueError as e:
            return Response({"detail": str(e)}, status=status.HTTP_400_BAD_REQUEST)

        if role_slugs is not None:
            PermissionService.set_user_roles(updated, role_slugs)

        return Response(UserListSerializer(updated).data)


class ToggleActiveView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request, user_id: int):
        try:
            user = UserService.toggle_active(user_id, request.user)
        except ValueError as e:
            return Response({"detail": str(e)}, status=status.HTTP_400_BAD_REQUEST)
        return Response(UserListSerializer(user).data)


class ResetPasswordView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request, user_id: int):
        serializer = ResetPasswordSerializer(data=request.data)
        if not serializer.is_valid():
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

        try:
            UserService.reset_password(user_id, serializer.validated_data["new_password"])
        except ValueError as e:
            return Response({"detail": str(e)}, status=status.HTTP_400_BAD_REQUEST)

        return Response({"detail": "Contraseña actualizada correctamente."})


class RoleChoicesView(APIView):
    """Devuelve los roles del nuevo sistema para el selector del modal."""
    permission_classes = [IsAuthenticated]

    def get(self, request):
        roles = Role.objects.all().order_by("name")
        return Response([
            {
                "value": r.slug,
                "label": r.name,
                "is_system": r.is_system,
                "description": r.description,
            }
            for r in roles
        ])