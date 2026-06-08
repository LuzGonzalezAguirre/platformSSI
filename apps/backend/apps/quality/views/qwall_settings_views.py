"""
Proxy views for QWall Settings (ssi_Users, ssi_PartNumbers, ssi_InspectionPoints,
ssi_FailModes, ssi_SystemConfig).  All reads/writes go through qwall-proxy;
Django only handles auth + RBAC.
"""

import os
import requests
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated

PROXY_URL   = os.getenv("QWALL_PROXY_URL",   "http://host.docker.internal:8002")
PROXY_TOKEN = os.getenv("QWALL_PROXY_TOKEN", "")
HEADERS     = {"Authorization": f"Bearer {PROXY_TOKEN}"}
TIMEOUT     = 30

ALLOWED_ROLES = {"admin", "quality_engineer"}


def _has_access(request) -> bool:
    roles = set(request.user.user_roles.values_list("role__slug", flat=True))
    return bool(roles & ALLOWED_ROLES)


def _forbidden():
    return Response({"error": "Forbidden"}, status=403)


def _proxy_get(path: str, params: dict | None = None) -> Response:
    try:
        resp = requests.get(f"{PROXY_URL}{path}", params=params, headers=HEADERS, timeout=TIMEOUT)
        resp.raise_for_status()
        return Response(resp.json())
    except requests.HTTPError as e:
        return Response({"error": e.response.text}, status=e.response.status_code)
    except Exception as e:
        return Response({"error": str(e)}, status=502)


def _proxy_post(path: str, body: dict) -> Response:
    try:
        resp = requests.post(f"{PROXY_URL}{path}", json=body, headers=HEADERS, timeout=TIMEOUT)
        resp.raise_for_status()
        return Response(resp.json())
    except requests.HTTPError as e:
        return Response({"error": e.response.text}, status=e.response.status_code)
    except Exception as e:
        return Response({"error": str(e)}, status=502)


def _proxy_patch(path: str, body: dict) -> Response:
    try:
        resp = requests.patch(f"{PROXY_URL}{path}", json=body, headers=HEADERS, timeout=TIMEOUT)
        resp.raise_for_status()
        return Response(resp.json())
    except requests.HTTPError as e:
        return Response({"error": e.response.text}, status=e.response.status_code)
    except Exception as e:
        return Response({"error": str(e)}, status=502)


def _proxy_delete(path: str) -> Response:
    try:
        resp = requests.delete(f"{PROXY_URL}{path}", headers=HEADERS, timeout=TIMEOUT)
        resp.raise_for_status()
        return Response(resp.json())
    except requests.HTTPError as e:
        return Response({"error": e.response.text}, status=e.response.status_code)
    except Exception as e:
        return Response({"error": str(e)}, status=502)


# ── Catalogs (read-only) ──────────────────────────────────────────────────────

class QWallBusinessUnitsView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        if not _has_access(request):
            return _forbidden()
        return _proxy_get("/settings/business-units")


class QWallRolesView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        if not _has_access(request):
            return _forbidden()
        return _proxy_get("/settings/qwall-roles")


# ── Users ─────────────────────────────────────────────────────────────────────

class QWallUsersView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        if not _has_access(request):
            return _forbidden()
        return _proxy_get("/settings/users")

    def post(self, request):
        if not _has_access(request):
            return _forbidden()
        return _proxy_post("/settings/users", request.data)


class QWallUserDetailView(APIView):
    permission_classes = [IsAuthenticated]

    def patch(self, request, user_id):
        if not _has_access(request):
            return _forbidden()
        return _proxy_patch(f"/settings/users/{user_id}", request.data)

    def delete(self, request, user_id):
        if not _has_access(request):
            return _forbidden()
        return _proxy_delete(f"/settings/users/{user_id}")


# ── Part Numbers ──────────────────────────────────────────────────────────────

class QWallPartNumbersView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        if not _has_access(request):
            return _forbidden()
        bu_id = request.query_params.get("bu_id")
        return _proxy_get("/settings/part-numbers", {"bu_id": bu_id} if bu_id else None)

    def post(self, request):
        if not _has_access(request):
            return _forbidden()
        return _proxy_post("/settings/part-numbers", request.data)


class QWallPartNumberDetailView(APIView):
    permission_classes = [IsAuthenticated]

    def patch(self, request, pn_id):
        if not _has_access(request):
            return _forbidden()
        return _proxy_patch(f"/settings/part-numbers/{pn_id}", request.data)

    def delete(self, request, pn_id):
        if not _has_access(request):
            return _forbidden()
        return _proxy_delete(f"/settings/part-numbers/{pn_id}")


# ── Inspection Points ─────────────────────────────────────────────────────────

class QWallInspectionPointsView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        if not _has_access(request):
            return _forbidden()
        bu_id = request.query_params.get("bu_id")
        return _proxy_get("/settings/inspection-points", {"bu_id": bu_id} if bu_id else None)

    def post(self, request):
        if not _has_access(request):
            return _forbidden()
        return _proxy_post("/settings/inspection-points", request.data)


class QWallInspectionPointDetailView(APIView):
    permission_classes = [IsAuthenticated]

    def patch(self, request, point_id):
        if not _has_access(request):
            return _forbidden()
        return _proxy_patch(f"/settings/inspection-points/{point_id}", request.data)

    def delete(self, request, point_id):
        if not _has_access(request):
            return _forbidden()
        return _proxy_delete(f"/settings/inspection-points/{point_id}")


# ── Fail Modes ────────────────────────────────────────────────────────────────

class QWallFailModesView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        if not _has_access(request):
            return _forbidden()
        bu_id = request.query_params.get("bu_id")
        return _proxy_get("/settings/fail-modes", {"bu_id": bu_id} if bu_id else None)

    def post(self, request):
        if not _has_access(request):
            return _forbidden()
        return _proxy_post("/settings/fail-modes", request.data)


class QWallFailModeDetailView(APIView):
    permission_classes = [IsAuthenticated]

    def patch(self, request, fail_mode_id):
        if not _has_access(request):
            return _forbidden()
        return _proxy_patch(f"/settings/fail-modes/{fail_mode_id}", request.data)

    def delete(self, request, fail_mode_id):
        if not _has_access(request):
            return _forbidden()
        return _proxy_delete(f"/settings/fail-modes/{fail_mode_id}")


class QWallFailModeAssignPointsView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request, fail_mode_id):
        if not _has_access(request):
            return _forbidden()
        return _proxy_post(f"/settings/fail-modes/{fail_mode_id}/assign-points", request.data)


# ── System Config ─────────────────────────────────────────────────────────────

class QWallSystemConfigView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        if not _has_access(request):
            return _forbidden()
        return _proxy_get("/settings/system-config")


class QWallSystemConfigDetailView(APIView):
    permission_classes = [IsAuthenticated]

    def patch(self, request, config_key):
        if not _has_access(request):
            return _forbidden()
        return _proxy_patch(f"/settings/system-config/{config_key}", request.data)
