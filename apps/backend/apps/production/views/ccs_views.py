"""
Proxy views for CCS SQL Server data (attendance barcode + chair control).
These views forward requests to qwall-proxy, which holds the Integrated Security connection.
"""

import os
import requests
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from rest_framework import status as http_status

PROXY_URL   = os.getenv("QWALL_PROXY_URL",   "http://host.docker.internal:8002")
PROXY_TOKEN = os.getenv("QWALL_PROXY_TOKEN", "")
HEADERS     = {"Authorization": f"Bearer {PROXY_TOKEN}"}
TIMEOUT     = 30


def _proxy_post(path: str, body: dict) -> Response:
    try:
        resp = requests.post(f"{PROXY_URL}{path}", json=body, headers=HEADERS, timeout=TIMEOUT)
        resp.raise_for_status()
        return Response(resp.json())
    except requests.HTTPError as e:
        return Response({"error": e.response.text}, status=e.response.status_code)
    except Exception as e:
        return Response({"error": str(e)}, status=502)


def _proxy_get(path: str, params: dict | None = None) -> Response:
    try:
        resp = requests.get(f"{PROXY_URL}{path}", params=params, headers=HEADERS, timeout=TIMEOUT)
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


# ── Attendance (Daily Manual Grid) ───────────────────────────────────────────

class CcsAttendanceDailyView(APIView):
    permission_classes = [IsAuthenticated]
    def get(self, request):
        return _proxy_get("/attendance/daily", {
            "date":  request.query_params.get("date"),
            "turno": request.query_params.get("turno"),
        })
    def post(self, request):
        return _proxy_post("/attendance/daily", request.data)


# ── Attendance (Barcode Check-In/Out) ─────────────────────────────────────────

class CcsCheckInView(APIView):
    permission_classes = [IsAuthenticated]
    def post(self, request):
        return _proxy_post("/attendance/check-in", request.data)


class CcsCheckOutView(APIView):
    permission_classes = [IsAuthenticated]
    def post(self, request):
        return _proxy_post("/attendance/check-out", request.data)


class CcsOvertimeView(APIView):
    permission_classes = [IsAuthenticated]
    def post(self, request):
        return _proxy_post("/attendance/overtime", request.data)


class CcsTodayStatusView(APIView):
    permission_classes = [IsAuthenticated]
    def get(self, request):
        return _proxy_get("/attendance/today-status", {"barcode_id": request.query_params.get("barcode_id")})


class CcsAttendanceRecordsView(APIView):
    permission_classes = [IsAuthenticated]
    def post(self, request):
        return _proxy_post("/attendance/records", request.data)


class CcsAttendanceKpisView(APIView):
    permission_classes = [IsAuthenticated]
    def post(self, request):
        return _proxy_post("/attendance/kpis", request.data)


class CcsEmployeesView(APIView):
    permission_classes = [IsAuthenticated]
    def get(self, request):
        return _proxy_get("/attendance/employees", {
            "department":      request.query_params.get("department"),
            "include_inactive": request.query_params.get("include_inactive"),
        })
    def post(self, request):
        return _proxy_post("/attendance/employees", request.data)


class CcsEmployeeDetailView(APIView):
    permission_classes = [IsAuthenticated]
    def patch(self, request, pk):
        return _proxy_patch(f"/attendance/employees/{pk}", request.data)
    def delete(self, request, pk):
        return _proxy_delete(f"/attendance/employees/{pk}")


# ── Chair Control (Ley Silla) ─────────────────────────────────────────────────

class ChairKpisView(APIView):
    permission_classes = [IsAuthenticated]
    def post(self, request):
        return _proxy_post("/chairs/kpis", request.data)


class ChairBreaksView(APIView):
    permission_classes = [IsAuthenticated]
    def post(self, request):
        return _proxy_post("/chairs/breaks", request.data)


class ChairDailyChartView(APIView):
    permission_classes = [IsAuthenticated]
    def post(self, request):
        return _proxy_post("/chairs/daily-chart", request.data)


class ChairTurnoChartView(APIView):
    permission_classes = [IsAuthenticated]
    def post(self, request):
        return _proxy_post("/chairs/turno-chart", request.data)
