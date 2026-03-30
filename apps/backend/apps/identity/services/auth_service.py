from django.contrib.auth import authenticate
from django.utils import timezone
from rest_framework_simplejwt.tokens import RefreshToken
from apps.identity.models import User


class AuthService:

    @staticmethod
    def login(employee_id: str, password: str) -> dict:
        user = authenticate(username=employee_id, password=password)
        if user is None:
            raise ValueError("Número de empleado o contraseña incorrectos.")
        if not user.is_active:
            raise ValueError("Usuario inactivo. Contacta al administrador.")

        user.last_login_at = timezone.now()
        user.save(update_fields=["last_login_at"])

        return AuthService._generate_tokens(user)

    @staticmethod
    def refresh_token(refresh_token: str) -> dict:
        try:
            token = RefreshToken(refresh_token)
            return {"access": str(token.access_token)}
        except Exception:
            raise ValueError("Token inválido o expirado.")

    @staticmethod
    def logout(refresh_token: str) -> None:
        try:
            token = RefreshToken(refresh_token)
            token.blacklist()
        except Exception:
            pass

    @staticmethod
    def _generate_tokens(user: User) -> dict:
        refresh = RefreshToken.for_user(user)
        refresh["employee_id"] = user.employee_id
        refresh["plant"] = user.plant
        return {
            "access": str(refresh.access_token),
            "refresh": str(refresh),
            "user": user,
        }