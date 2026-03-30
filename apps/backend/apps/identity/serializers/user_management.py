from rest_framework import serializers
from apps.identity.models import User


class UserRoleSerializer(serializers.Serializer):
    id          = serializers.IntegerField()
    name        = serializers.CharField()
    slug        = serializers.CharField()
    is_system   = serializers.BooleanField()


class UserListSerializer(serializers.ModelSerializer):
    full_name    = serializers.CharField(read_only=True)
    role_display = serializers.SerializerMethodField()
    roles        = serializers.SerializerMethodField()

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
            "is_active",
            "date_joined",
            "last_login",
        ]
        read_only_fields = fields

    def get_role_display(self, obj) -> str:
        names = list(obj.roles.values_list("name", flat=True))
        return ", ".join(names) if names else "Sin rol"

    def get_roles(self, obj) -> list:
        return list(obj.roles.values("id", "name", "slug", "is_system"))

class UserCreateSerializer(serializers.ModelSerializer):
    password = serializers.CharField(write_only=True, min_length=8)
    email    = serializers.EmailField(required=False, allow_blank=True, default="")

    class Meta:
        model = User
        fields = [
            "employee_id",
            "first_name",
            "last_name",
            "email",
            "plant",
            "preferred_language",
            "password",
        ]


class UserUpdateSerializer(serializers.ModelSerializer):
    email = serializers.EmailField(required=False, allow_blank=True)

    class Meta:
        model = User
        fields = [
            "first_name",
            "last_name",
            "email",
            "plant",
            "preferred_language",
            "is_active",
        ]


class ResetPasswordSerializer(serializers.Serializer):
    new_password     = serializers.CharField(min_length=8, write_only=True)
    confirm_password = serializers.CharField(min_length=8, write_only=True)

    def validate(self, data):
        if data["new_password"] != data["confirm_password"]:
            raise serializers.ValidationError(
                {"confirm_password": "Las contraseñas no coinciden."}
            )
        return data


class RoleChoiceSerializer(serializers.Serializer):
    value       = serializers.CharField()
    label       = serializers.CharField()
    is_system   = serializers.BooleanField()
    description = serializers.CharField()