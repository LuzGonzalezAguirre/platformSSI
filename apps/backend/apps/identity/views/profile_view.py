from rest_framework import status
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework.parsers import MultiPartParser, FormParser

from apps.identity.serializers import UserSerializer
from apps.identity.serializers.profile import (
    ProfileUpdateSerializer,
    ChangePasswordSerializer,
)
from apps.identity.services.profile_service import ProfileService


class ProfileUpdateView(APIView):
    permission_classes = [IsAuthenticated]

    def patch(self, request):
        serializer = ProfileUpdateSerializer(
            request.user,
            data=request.data,
            partial=True,
        )
        if not serializer.is_valid():
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

        updated = ProfileService.update_profile(request.user, serializer.validated_data)
        return Response(UserSerializer(updated).data)


class ChangePasswordView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request):
        serializer = ChangePasswordSerializer(data=request.data)
        if not serializer.is_valid():
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

        try:
            ProfileService.change_password(
                request.user,
                serializer.validated_data["current_password"],
                serializer.validated_data["new_password"],
            )
        except ValueError as e:
            return Response({"detail": str(e)}, status=status.HTTP_400_BAD_REQUEST)

        return Response({"detail": "Contraseña actualizada correctamente."})
    
class AvatarUploadView(APIView):
    permission_classes = [IsAuthenticated]
    parser_classes = [MultiPartParser, FormParser]

    def post(self, request):
        avatar = request.FILES.get("avatar")
        if not avatar:
            return Response(
                {"detail": "No se proporcionó ninguna imagen."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        allowed_types = ["image/jpeg", "image/png", "image/webp"]
        if avatar.content_type not in allowed_types:
            return Response(
                {"detail": "Formato no permitido. Usa JPG, PNG o WEBP."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        if avatar.size > 2 * 1024 * 1024:
            return Response(
                {"detail": "La imagen no puede superar 2MB."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        if request.user.avatar:
            request.user.avatar.delete(save=False)

        request.user.avatar = avatar
        request.user.save(update_fields=["avatar"])

        serializer = UserSerializer(request.user, context={"request": request})
        return Response(serializer.data)