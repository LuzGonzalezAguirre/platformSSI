"""
Proxy views for QWall Settings (ssi_Users, ssi_PartNumbers, ssi_InspectionPoints,
ssi_FailModes, ssi_SystemConfig).  All reads/writes go through qwall-proxy;
Django only handles auth + RBAC.
"""

import os
import requests
from django.core.cache import cache
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from apps.quality.models import FailModeTranslation, QWallSettings
from apps.quality.services.fail_mode_translation_service import FailModeTranslationService

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

        english_name = (request.data.get("english_name") or "").strip()
        if not english_name:
            return Response({"error": "english_name es obligatorio."}, status=400)

        body = {"fail_code": request.data.get("fail_code"), "description": request.data.get("description")}
        resp = _proxy_post("/settings/fail-modes", body)
        if resp.status_code >= 400:
            return resp

        fail_code = resp.data.get("fail_code")
        if fail_code:
            FailModeTranslationService.upsert(fail_code, "en", english_name)

        return resp


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


# ── Fail Mode Translations (Postgres — CCS permanece 100% solo-lectura) ───────
# fail_mode_code es una llave lógica al fail_code de CCS, nunca FK real.

class QWallFailModeTranslationsView(APIView):
    """Lista fail modes de CCS + su traducción actual (o fallback) para el locale pedido."""
    permission_classes = [IsAuthenticated]

    def get(self, request):
        if not _has_access(request):
            return _forbidden()
        locale = request.query_params.get("locale", "en")
        params = {}
        bu_id = request.query_params.get("bu_id")
        point_id = request.query_params.get("point_id")
        if bu_id:
            params["bu_id"] = bu_id
        if point_id:
            params["point_id"] = point_id

        try:
            resp = requests.get(
                f"{PROXY_URL}/settings/fail-modes", params=params or None, headers=HEADERS, timeout=TIMEOUT,
            )
            resp.raise_for_status()
            raw = resp.json().get("data", [])
        except requests.HTTPError as e:
            return Response({"error": e.response.text}, status=e.response.status_code)
        except Exception as e:
            return Response({"error": str(e)}, status=502)

        codes = [r["fail_code"] for r in raw]
        translations = dict(
            FailModeTranslation.objects
            .filter(locale=locale, fail_mode_code__in=codes)
            .values_list("fail_mode_code", "name")
        )
        merged = [
            {
                **r,
                "translated_name": translations.get(r["fail_code"]),
                "has_translation": r["fail_code"] in translations,
            }
            for r in raw
        ]
        return Response({"data": merged})


class QWallFailModeTranslationsMissingView(APIView):
    """fail_mode_code que existen en CCS pero sin traducción para el locale pedido."""
    permission_classes = [IsAuthenticated]

    def get(self, request):
        if not _has_access(request):
            return _forbidden()
        locale = request.query_params.get("locale", "en")

        try:
            resp = requests.get(f"{PROXY_URL}/settings/fail-modes", headers=HEADERS, timeout=TIMEOUT)
            resp.raise_for_status()
            raw = resp.json().get("data", [])
        except requests.HTTPError as e:
            return Response({"error": e.response.text}, status=e.response.status_code)
        except Exception as e:
            return Response({"error": str(e)}, status=502)

        codes = [r["fail_code"] for r in raw if r.get("is_active", 1)]
        missing = FailModeTranslationService.get_missing(codes, locale)
        return Response({"data": missing})


class QWallFailModeTranslationDetailView(APIView):
    """Upsert de la traducción de un fail_mode_code para un locale específico."""
    permission_classes = [IsAuthenticated]

    def put(self, request, fail_mode_code):
        if not _has_access(request):
            return _forbidden()
        locale = (request.data.get("locale") or "en").strip()
        name = (request.data.get("name") or "").strip()
        if not name:
            return Response({"error": "name es requerido."}, status=400)

        obj = FailModeTranslationService.upsert(fail_mode_code, locale, name)
        return Response({
            "fail_mode_code": obj.fail_mode_code,
            "locale":         obj.locale,
            "name":           obj.name,
        })


# ── Pass Rate Target (Postgres, valor global único, sin historial) ────────────

class QWallPassRateTargetView(APIView):
    """Lectura abierta a cualquier rol autenticado con acceso al dashboard;
    escritura restringida a admin/quality_engineer."""
    permission_classes = [IsAuthenticated]

    def get(self, request):
        obj = QWallSettings.get_solo()
        return Response({"pass_rate_target": float(obj.pass_rate_target)})

    def put(self, request):
        if not _has_access(request):
            return _forbidden()
        try:
            value = float(request.data.get("pass_rate_target"))
        except (TypeError, ValueError):
            return Response({"error": "pass_rate_target inválido."}, status=400)

        obj = QWallSettings.get_solo()
        obj.pass_rate_target = value
        obj.updated_by = request.user
        obj.save(update_fields=["pass_rate_target", "updated_by", "updated_at"])
        cache.delete("qwall:pass_rate_target")
        return Response({"pass_rate_target": float(obj.pass_rate_target)})
