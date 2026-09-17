from rest_framework import status
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.identity.models import User
from apps.quality.models import ProblemControlSettings


def _user_data(user):
    if not user:
        return None
    return {
        "id": user.id,
        "username": user.employee_id,
        "first_name": user.first_name,
        "last_name": user.last_name,
        "email": user.email,
        "job_title": user.job_title,
    }


def _is_admin(user):
    return bool(
        user
        and user.is_authenticated
        and (
            user.is_superuser
            or user.roles.filter(slug="admin").exists()
        )
    )


class ProblemControlSettingsView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        settings_obj = ProblemControlSettings.load()
        return Response({
            "quality_manager": _user_data(settings_obj.quality_manager),
            "updated_at": settings_obj.updated_at,
            "updated_by": _user_data(settings_obj.updated_by),
            "can_edit": _is_admin(request.user),
        })

    def put(self, request):
        if not _is_admin(request.user):
            return Response(
                {"detail": "Only administrators can change the Problem Control Quality Manager."},
                status=status.HTTP_403_FORBIDDEN,
            )

        manager_id = request.data.get("quality_manager_id")
        manager = None
        if manager_id not in (None, "", 0, "0"):
            manager = User.objects.filter(pk=manager_id, is_active=True).first()
            if not manager:
                return Response(
                    {"detail": "Selected Quality Manager was not found or is inactive."},
                    status=status.HTTP_400_BAD_REQUEST,
                )

        settings_obj = ProblemControlSettings.load()
        settings_obj.quality_manager = manager
        settings_obj.updated_by = request.user
        settings_obj.save(update_fields=["quality_manager", "updated_by", "updated_at"])

        return Response({
            "quality_manager": _user_data(settings_obj.quality_manager),
            "updated_at": settings_obj.updated_at,
            "updated_by": _user_data(settings_obj.updated_by),
            "can_edit": True,
        })
