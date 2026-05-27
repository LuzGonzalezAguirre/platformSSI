from django.contrib.auth import authenticate
from django.utils import timezone
from rest_framework_simplejwt.tokens import RefreshToken
from apps.identity.models import User


def _log_audit(user, action: str, ip: str = None, user_agent: str = ""):
    try:
        from apps.audit.models import AuditLog
        AuditLog.objects.create(
            user=user,
            action=action,
            module="identity",
            resource="session",
            ip_address=ip,
            user_agent=user_agent[:255],
        )
    except Exception:
        pass


class AuthService:

    @staticmethod
    def login(employee_id: str, password: str, ip: str = None, user_agent: str = "") -> dict:
        user = authenticate(username=employee_id, password=password)
        if user is None:
            raise ValueError("Número de empleado o contraseña incorrectos.")
        if not user.is_active:
            raise ValueError("Usuario inactivo. Contacta al administrador.")

        user.last_login_at = timezone.now()
        user.save(update_fields=["last_login_at"])

        _log_audit(user, "LOGIN", ip=ip, user_agent=user_agent)
        return AuthService._generate_tokens(user)

    @staticmethod
    def refresh_token(refresh_token: str) -> dict:
        try:
            token = RefreshToken(refresh_token)
            return {"access": str(token.access_token)}
        except Exception:
            raise ValueError("Token inválido o expirado.")

    @staticmethod
    def logout(refresh_token: str, user=None, ip: str = None, user_agent: str = "") -> None:
        try:
            token = RefreshToken(refresh_token)
            token.blacklist()
        except Exception:
            pass
        if user is not None:
            _log_audit(user, "LOGOUT", ip=ip, user_agent=user_agent)

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