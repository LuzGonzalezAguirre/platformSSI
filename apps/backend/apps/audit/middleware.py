from django.utils.deprecation import MiddlewareMixin

METHOD_ACTION_MAP = {
    "POST": "CREATE",
    "PUT": "UPDATE",
    "PATCH": "UPDATE",
    "DELETE": "DELETE",
}

MODULE_PATH_MAP = {
    "auth": "identity",
    "quality": "quality",
    "production": "production",
    "maintenance": "maintenance",
    "warehouse": "warehouse",
    "manufacturing": "manufacturing",
    "permissions": "permissions",
    "audit": "audit",
}

SKIP_PREFIXES = ("/admin/", "/static/", "/media/", "/__debug__/")


def _get_module(path: str) -> str:
    parts = path.strip("/").split("/")
    if len(parts) >= 3:
        return MODULE_PATH_MAP.get(parts[2], parts[2])
    return ""


def _get_resource(path: str) -> str:
    parts = path.strip("/").split("/")
    return parts[3] if len(parts) >= 4 else ""


def _get_client_ip(request) -> str | None:
    forwarded = request.META.get("HTTP_X_FORWARDED_FOR")
    if forwarded:
        return forwarded.split(",")[0].strip()
    return request.META.get("REMOTE_ADDR")


def _get_authenticated_user(request):
    auth_header = request.META.get("HTTP_AUTHORIZATION", "")
    if not auth_header.startswith("Bearer "):
        return None
    try:
        from rest_framework_simplejwt.authentication import JWTAuthentication
        jwt_auth = JWTAuthentication()
        validated_token = jwt_auth.get_validated_token(auth_header.split(" ", 1)[1])
        return jwt_auth.get_user(validated_token)
    except Exception:
        return None


class AuditMiddleware(MiddlewareMixin):
    def process_response(self, request, response):
        method = request.method.upper()
        action = METHOD_ACTION_MAP.get(method)
        if not action:
            return response

        path = request.path
        if any(path.startswith(p) for p in SKIP_PREFIXES):
            return response

        # only log successful mutations
        if response.status_code >= 400:
            return response

        # skip audit endpoints to avoid recursion
        if "/api/v1/audit/" in path:
            return response

        user = _get_authenticated_user(request)
        if user is None:
            return response

        resource_id = ""
        description = ""
        try:
            import json
            body = json.loads(response.content)
            if isinstance(body, dict):
                resource_id = str(body.get("id", ""))
                for field in ("brief_description", "name", "description", "title", "employee_id"):
                    value = body.get(field)
                    if value:
                        description = str(value)[:200]
                        break
        except Exception:
            pass

        try:
            from apps.audit.models import AuditLog
            AuditLog.objects.create(
                user=user,
                action=action,
                module=_get_module(path),
                resource=_get_resource(path),
                resource_id=resource_id,
                description=description,
                ip_address=_get_client_ip(request),
                user_agent=request.META.get("HTTP_USER_AGENT", "")[:255],
            )
        except Exception:
            pass

        return response
