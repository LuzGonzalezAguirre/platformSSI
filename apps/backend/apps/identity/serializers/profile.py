from rest_framework import serializers
from apps.identity.models import User

ROLES_REQUIRING_EMAIL = {"supervisor", "ingeniero", "admin", "gerente"}


class ProfileUpdateSerializer(serializers.ModelSerializer):
    email = serializers.EmailField(required=False, allow_blank=True)

    class Meta:
        model = User
        fields = [
            "first_name",
            "last_name",
            "email",
            "preferred_language",
            "preferred_theme",
            "timezone",
        ]

    def validate(self, data):
        instance = self.instance
        email = data.get("email", instance.email if instance else "")
        user_roles = set(instance.roles.values_list("slug", flat=True))

        if user_roles & ROLES_REQUIRING_EMAIL and not email:
            raise serializers.ValidationError(
                {"email": "Este rol requiere una dirección de email."}
            )
        return data


class ChangePasswordSerializer(serializers.Serializer):
    current_password = serializers.CharField(write_only=True)
    new_password = serializers.CharField(write_only=True, min_length=8)
    confirm_password = serializers.CharField(write_only=True, min_length=8)

    def validate(self, data):
        if data["new_password"] != data["confirm_password"]:
            raise serializers.ValidationError(
                {"confirm_password": "Las contraseñas no coinciden."}
            )
        if data["current_password"] == data["new_password"]:
            raise serializers.ValidationError(
                {"new_password": "La nueva contraseña debe ser diferente a la actual."}
            )
        return data