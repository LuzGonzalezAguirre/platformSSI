"""Authenticated read-only bridge for checksheet validation.

Never sends Teams alerts. Never exposes the Plex proxy credential to React.
"""
from django.conf import settings
from rest_framework.views import APIView
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
import httpx


class ChecksheetDiagnosticView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request):
        payload = request.data
        if not isinstance(payload, dict):
            return Response({"detail": "Expected a JSON object."}, status=400)
        allowed = {
            "workcenter_key", "part_key", "control_plan_key", "job_op_key",
            "operation_numbers", "window_start", "window_end",
            "timer_anchor", "evaluation_at", "include_checksheet_downtime",
            "include_workcenter_context",
        }
        unexpected = set(payload) - allowed
        if unexpected:
            return Response({"detail": "Unsupported diagnostic parameters."}, status=400)

        base = str(settings.PLEX_PROXY_URL).rstrip("/")
        token = settings.PLEX_PROXY_SECRET
        try:
            with httpx.Client(timeout=75.0) as client:
                upstream = client.post(
                    f"{base}/production-checksheets/diagnostic",
                    json=payload,
                    headers={"Authorization": f"Bearer {token}"},
                )
            if upstream.status_code == 422:
                return Response({"detail": "Invalid checksheet diagnostic parameters.", "validation": upstream.json().get("detail")}, status=400)
            upstream.raise_for_status()
            data = upstream.json()
            return Response(data)
        except (httpx.TimeoutException, httpx.NetworkError):
            return Response({"detail": "Plex proxy unavailable."}, status=502)
        except (httpx.HTTPStatusError, ValueError):
            return Response({"detail": "Plex checksheet diagnostic request failed."}, status=502)
