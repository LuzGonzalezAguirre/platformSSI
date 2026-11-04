"""Authenticated read-only bridge for checksheet validation.

Never sends Teams alerts. Never exposes the Plex proxy credential to React.
"""
from django.conf import settings
from rest_framework.views import APIView
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
import httpx
from apps.production.checksheet_catalog import catalog, summarize_monitor
from apps.production.checksheet_freshness import assess_capture_freshness


class ChecksheetDiagnosticView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request):
        payload = request.data
        if not isinstance(payload, dict):
            return Response({"detail": "Expected a JSON object."}, status=400)
        allowed = {
            "workcenter_key", "part_key", "control_plan_key", "job_op_key", "operation_job_op_keys",
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


class ChecksheetMonitorView(APIView):
    """Read-only pilot area/WC overview. Never schedules Teams alerts."""
    permission_classes = [IsAuthenticated]

    def get(self, request):
        return Response({"data": catalog()})

    def post(self, request):
        # Deliberately use server-owned catalog, not arbitrary client keys,
        # to prevent this endpoint from becoming an unbounded ODBC scanner.
        monitored = catalog()
        base = str(settings.PLEX_PROXY_URL).rstrip("/")
        token = settings.PLEX_PROXY_SECRET
        rows = []
        try:
            with httpx.Client(timeout=120.0) as client:
                for wc in monitored:
                    summaries = []
                    for group in wc["groups"]:
                        response = client.post(
                            f"{base}/production-checksheets/sequence-diagnostic",
                            json={
                                "workcenter_key": wc["workcenter_key"],
                                "part_key": wc["part_key"],
                                "control_plan_key": wc["control_plan_key"],
                                "section_ids": group["section_ids"],
                            },
                            headers={"Authorization": f"Bearer {token}"},
                        )
                        response.raise_for_status()
                        upstream = response.json()["data"]
                        summary = upstream["workcenter_summary"]
                        summaries.append({
                            "freshness": assess_capture_freshness(None, None),
                            "group_key": group["group_key"],
                            "group_name": group["name"],
                            "department": group["department"],
                            "status": "UNVERIFIED",
                            "historical_sequence_state": summary["historical_sequence_state"],
                            "complete_historical_cycles": summary["complete_historical_cycles"],
                            "last_historical_completion_at": summary["last_historical_completion_at"],
                            "next_expected_section_from_history": summary["next_expected_section_from_history"],
                            "evidence_truncated": upstream["evidence_truncated"],
                            "evidence_rows_scanned": upstream["evidence_rows_scanned"],
                            "blocking_reasons": summary["blocking_reasons"],
                        })
                    rows.append({**wc, "groups": summaries})
        except (httpx.HTTPError, ValueError, KeyError, TypeError):
            return Response({"detail": "Plex checksheet monitor unavailable or incompatible."}, status=502)

        result = summarize_monitor(rows)
        return Response({"data": result})
