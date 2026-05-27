from rest_framework import status
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.identity.serializers import LoginSerializer, TokenResponseSerializer, UserSerializer
from apps.identity.services import AuthService


class LoginView(APIView):
    permission_classes = [AllowAny]

    def post(self, request):
        serializer = LoginSerializer(data=request.data)
        if not serializer.is_valid():
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

        try:
            forwarded = request.META.get("HTTP_X_FORWARDED_FOR")
            ip = forwarded.split(",")[0].strip() if forwarded else request.META.get("REMOTE_ADDR")
            result = AuthService.login(
                employee_id=serializer.validated_data["employee_id"],
                password=serializer.validated_data["password"],
                ip=ip,
                user_agent=request.META.get("HTTP_USER_AGENT", ""),
            )
        except ValueError as e:
            return Response(
                {"detail": str(e)},
                status=status.HTTP_401_UNAUTHORIZED,
            )

        response_data = {
            "access": result["access"],
            "refresh": result["refresh"],
            "user": UserSerializer(result["user"], context={"request": request}).data,
        }
        return Response(response_data, status=status.HTTP_200_OK)


class LogoutView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request):
        refresh_token = request.data.get("refresh")
        if not refresh_token:
            return Response(
                {"detail": "Token de refresco requerido."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        forwarded = request.META.get("HTTP_X_FORWARDED_FOR")
        ip = forwarded.split(",")[0].strip() if forwarded else request.META.get("REMOTE_ADDR")
        AuthService.logout(
            refresh_token,
            user=request.user,
            ip=ip,
            user_agent=request.META.get("HTTP_USER_AGENT", ""),
        )
        return Response({"detail": "Sesión cerrada correctamente."}, status=status.HTTP_200_OK)


class MeView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        return Response(UserSerializer(request.user, context={"request": request}).data)

    def patch(self, request):
        serializer = UserSerializer(request.user, data=request.data, partial=True)
        if not serializer.is_valid():
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
        serializer.save()
        return Response(UserSerializer(request.user, context={"request": request}).data)


class RefreshView(APIView):
    permission_classes = [AllowAny]

    def post(self, request):
        refresh_token = request.data.get("refresh")
        if not refresh_token:
            return Response(
                {"detail": "Token de refresco requerido."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        try:
            result = AuthService.refresh_token(refresh_token)
            return Response(result, status=status.HTTP_200_OK)
        except ValueError as e:
            return Response({"detail": str(e)}, status=status.HTTP_401_UNAUTHORIZED)