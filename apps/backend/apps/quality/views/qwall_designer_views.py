"""Adaptador de Q-Wall Designer al proxy CCS existente.

Las rutas /designer/* requieren su implementación correspondiente en qwall-proxy.
No conecta Django directamente a SQL Server.
"""
import os
import requests
from django.http import Http404
from rest_framework.views import APIView
from rest_framework.response import Response
from apps.permissions.services import PermissionService

PROXY_URL = os.getenv("QWALL_PROXY_URL", "http://host.docker.internal:8002").rstrip("/")
PROXY_TOKEN = os.getenv("QWALL_PROXY_TOKEN", "")
TIMEOUT = 30
RESOURCE_NAMES = frozenset({"steps", "business-units", "part-numbers", "inspection-points"})
STEP_ACTIONS = frozenset({"save_positions", "update_image", "clone_to_models", "publish"})


class QWallDesignerProxyView(APIView):
    """Verifica los permisos de platformSSI antes de delegar a CCS."""

    def _forward(self, request, resource, pk=None, action=None):
        required = {
            "GET": "view", "POST": "create", "PATCH": "edit", "PUT": "edit", "DELETE": "delete",
        }.get(request.method)
        if action:
            required = "edit"
        if not required or not PermissionService.has_permission(request.user, "quality", required):
            return Response({"detail": "Forbidden"}, status=403)
        if resource not in RESOURCE_NAMES:
            raise Http404()
        if action and (resource != "steps" or not pk or action not in STEP_ACTIONS):
            raise Http404()
        if pk is not None and (not str(pk).isdigit() or int(pk) <= 0):
            raise Http404()
        path = f"/designer/{resource}"
        if pk is not None:
            path += f"/{pk}"
        if action:
            path += f"/{action}"
        headers = {"Authorization": f"Bearer {PROXY_TOKEN}", "X-Designer-User": str(request.user.get_username())[:100]}
        try:
            response = requests.request(
                request.method, f"{PROXY_URL}{path}",
                headers=headers, params=request.query_params,
                json=request.data if request.method in {"POST", "PATCH", "PUT"} else None,
                timeout=TIMEOUT,
            )
            try:
                data = response.json()
            except ValueError:
                data = {"detail": "Respuesta no JSON del servicio Q-Wall"}
            return Response(data, status=response.status_code)
        except requests.RequestException:
            return Response({"detail": "Servicio Q-Wall no disponible"}, status=502)

    def get(self, request, resource, pk=None, action=None):
        return self._forward(request, resource, pk, action)

    def post(self, request, resource, pk=None, action=None):
        return self._forward(request, resource, pk, action)

    def patch(self, request, resource, pk=None, action=None):
        return self._forward(request, resource, pk, action)

    def delete(self, request, resource, pk=None, action=None):
        return self._forward(request, resource, pk, action)
