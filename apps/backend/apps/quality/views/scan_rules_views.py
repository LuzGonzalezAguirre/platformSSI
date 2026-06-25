import os

import requests
from rest_framework.exceptions import ValidationError as DRFValidationError
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.quality.serializers.scan_rules_serializers import PartNumberScanRuleSerializer
from apps.quality.services.scan_rules_service import ScanRulesService

PROXY_URL   = os.getenv("QWALL_PROXY_URL",   "http://host.docker.internal:8002")
PROXY_TOKEN = os.getenv("QWALL_PROXY_TOKEN", "")
_HEADERS    = {"Authorization": f"Bearer {PROXY_TOKEN}"}
TIMEOUT     = 30

ALLOWED_ROLES = {"admin", "quality_engineer"}


def _has_access(request) -> bool:
    roles = set(request.user.user_roles.values_list("role__slug", flat=True))
    return bool(roles & ALLOWED_ROLES)


def _forbidden():
    return Response({"detail": "Forbidden"}, status=403)


def _proxy_error(exc: Exception):
    if isinstance(exc, requests.HTTPError):
        return Response({"error": exc.response.text}, status=exc.response.status_code)
    return Response({"error": str(exc)}, status=502)


# ── List / Create ──────────────────────────────────────────────────────────────

class ScanRuleListCreateView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        if not _has_access(request):
            return _forbidden()

        bu_id     = request.query_params.get("bu_id")
        is_active = request.query_params.get("is_active")
        pn_id     = request.query_params.get("pn_id")

        if bu_id is not None:
            try:
                bu_id = int(bu_id)
            except ValueError:
                return Response({"detail": "Invalid bu_id."}, status=400)

        if pn_id is not None:
            try:
                pn_id = int(pn_id)
            except ValueError:
                return Response({"detail": "Invalid pn_id."}, status=400)

        if is_active is not None:
            is_active = is_active.lower() in ("1", "true")

        try:
            if pn_id is not None:
                rule = ScanRulesService.get_rule_by_pn(pn_id)
                return Response([rule] if rule else [])

            rules = ScanRulesService.get_all_rules(bu_id=bu_id, is_active=is_active)
            return Response(rules)
        except Exception as exc:
            return _proxy_error(exc)

    def post(self, request):
        if not _has_access(request):
            return _forbidden()

        serializer = PartNumberScanRuleSerializer(data=request.data)
        if not serializer.is_valid():
            return Response(serializer.errors, status=400)

        try:
            rule = ScanRulesService.create_rule(
                dict(serializer.validated_data), request.user
            )
        except DRFValidationError as exc:
            return Response({"detail": exc.detail}, status=400)
        except Exception as exc:
            return _proxy_error(exc)

        return Response(rule, status=201)


# ── Detail (GET / PATCH / DELETE) ─────────────────────────────────────────────

class ScanRuleDetailView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request, pk):
        if not _has_access(request):
            return _forbidden()
        try:
            rule = ScanRulesService.get_rule(pk)
        except Exception as exc:
            return _proxy_error(exc)
        if rule is None:
            return Response({"detail": "Not found."}, status=404)
        return Response(rule)

    def patch(self, request, pk):
        if not _has_access(request):
            return _forbidden()

        serializer = PartNumberScanRuleSerializer(data=request.data, partial=True)
        if not serializer.is_valid():
            return Response(serializer.errors, status=400)

        try:
            updated = ScanRulesService.update_rule(
                pk, dict(serializer.validated_data), request.user
            )
        except DRFValidationError as exc:
            return Response({"detail": exc.detail}, status=400)
        except Exception as exc:
            return _proxy_error(exc)

        if updated is None:
            return Response({"detail": "Not found."}, status=404)
        return Response(updated)

    def delete(self, request, pk):
        if not _has_access(request):
            return _forbidden()
        try:
            found = ScanRulesService.delete_rule(pk)
        except Exception as exc:
            return _proxy_error(exc)
        if not found:
            return Response({"detail": "Not found."}, status=404)
        return Response(status=204)


# ── Toggle active ──────────────────────────────────────────────────────────────

class ScanRuleToggleView(APIView):
    permission_classes = [IsAuthenticated]

    def patch(self, request, pk):
        if not _has_access(request):
            return _forbidden()
        try:
            result = ScanRulesService.toggle_active(pk, request.user)
        except Exception as exc:
            return _proxy_error(exc)
        if result is None:
            return Response({"detail": "Not found."}, status=404)
        return Response(result)


# ── PN lookup (proxy pass-through) ────────────────────────────────────────────

class PartNumberLookupView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        if not _has_access(request):
            return _forbidden()
        try:
            resp = requests.get(
                f"{PROXY_URL}/settings/part-numbers-lookup",
                headers=_HEADERS,
                timeout=TIMEOUT,
            )
            resp.raise_for_status()
            items = resp.json().get("data", [])
        except requests.HTTPError as exc:
            return Response({"error": exc.response.text}, status=exc.response.status_code)
        except Exception as exc:
            return Response({"error": str(exc)}, status=502)

        bu_id = request.query_params.get("bu_id")
        if bu_id:
            try:
                bu_id = int(bu_id)
                items = [i for i in items if i.get("bu_id") == bu_id]
            except ValueError:
                pass

        return Response({"data": items})
