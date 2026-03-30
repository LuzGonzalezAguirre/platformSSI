from rest_framework import serializers
from apps.permissions.models import RolePermission, UserPermissionOverride, Module, Action


class RolePermissionSerializer(serializers.ModelSerializer):
    class Meta:
        model = RolePermission
        fields = ["id", "role", "module", "action"]


class UserPermissionOverrideSerializer(serializers.ModelSerializer):
    class Meta:
        model = UserPermissionOverride
        fields = ["id", "user", "module", "action", "override_type"]


class PermissionMatrixSerializer(serializers.Serializer):
    module = serializers.ChoiceField(choices=Module.choices)
    action = serializers.ChoiceField(choices=Action.choices)


class SetRolePermissionsSerializer(serializers.Serializer):
    permissions = PermissionMatrixSerializer(many=True)


class UserOverrideSerializer(serializers.Serializer):
    module = serializers.ChoiceField(choices=Module.choices)
    action = serializers.ChoiceField(choices=Action.choices)
    override_type = serializers.ChoiceField(choices=["grant", "revoke"])


class ModuleChoiceSerializer(serializers.Serializer):
    value = serializers.CharField()
    label = serializers.CharField()


class ActionChoiceSerializer(serializers.Serializer):
    value = serializers.CharField()
    label = serializers.CharField()