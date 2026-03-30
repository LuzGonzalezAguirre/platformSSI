from rest_framework import serializers
from apps.identity.models import User


class LoginSerializer(serializers.Serializer):
    employee_id = serializers.CharField(
        max_length=20,
        error_messages={"required": "El número de empleado es obligatorio."},
    )
    password = serializers.CharField(
        write_only=True,
        error_messages={"required": "La contraseña es obligatoria."},
    )


class UserSerializer(serializers.ModelSerializer):
    full_name      = serializers.CharField(read_only=True)
    role_display   = serializers.SerializerMethodField()
    requires_email = serializers.SerializerMethodField()
    avatar_url     = serializers.SerializerMethodField()
    permissions    = serializers.SerializerMethodField()
    roles          = serializers.SerializerMethodField()
    last_login_at  = serializers.DateTimeField(read_only=True, format="%Y-%m-%dT%H:%M:%SZ")

    class Meta:
        model = User
        fields = [
            "id",
            "employee_id",
            "first_name",
            "last_name",
            "full_name",
            "email",
            "role_display",
            "roles",
            "plant",
            "preferred_language",
            "preferred_theme",
            "timezone",
            "last_login_at",
            "requires_email",
            "is_active",
            "avatar_url",
            "permissions",
        ]
        read_only_fields = ["id", "employee_id"]

    def get_role_display(self, obj) -> str:
        return obj.role_display

    def get_requires_email(self, obj) -> bool:
        return bool(obj.email)

    def get_avatar_url(self, obj) -> str | None:
        if obj.avatar:
            request = self.context.get("request")
            if request:
                return request.build_absolute_uri(obj.avatar.url)
            return obj.avatar.url
        return None

    def get_permissions(self, obj) -> dict:
        from apps.permissions.services import PermissionService
        return PermissionService.get_user_permissions(obj)

    def get_roles(self, obj) -> list:
        return list(obj.roles.values("id", "name", "slug"))


class TokenResponseSerializer(serializers.Serializer):
    access  = serializers.CharField()
    refresh = serializers.CharField()
    user    = UserSerializer()