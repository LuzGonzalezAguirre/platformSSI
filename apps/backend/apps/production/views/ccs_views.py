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
        date_str = request.query_params.get("date")
        turno    = request.query_params.get("turno")

        # 1. Employees from SQL Server via proxy (returns defaults for status/hours)
        employees_resp = _proxy_get("/attendance/daily", {"date": date_str, "turno": turno})
        if employees_resp.status_code != 200:
            return employees_resp
        employees = list(employees_resp.data)

        # 2. Overlay PostgreSQL attendance records for that date
        if date_str:
            from apps.production.models import CcsAttendanceRecord
            att_map = {
                r.ccs_employee_id: r
                for r in CcsAttendanceRecord.objects.filter(date=date_str)
            }
            for emp in employees:
                rec = att_map.get(emp["employee_id"])
                if rec:
                    emp["id"]          = rec.id
                    emp["status"]      = rec.status
                    emp["hours"]       = str(rec.hours)
                    emp["recorded_at"] = rec.recorded_at.isoformat() if rec.recorded_at else None

        return Response(employees)

    def post(self, request):
        from apps.production.models import CcsAttendanceRecord
        records = request.data.get("records", [])
        saved = 0
        for r in records:
            h = 0.0 if r.get("status") == "absent" else float(r.get("hours", 12.0))
            CcsAttendanceRecord.objects.update_or_create(
                ccs_employee_id=r["employee_id"],
                date=r["date"],
                defaults={
                    "turno":       r["turno"],
                    "status":      r["status"],
                    "hours":       h,
                    "recorded_by": request.user,
                },
            )
            saved += 1
        return Response({"saved": saved})


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

class CcsEmployeeReactivateView(APIView):
    permission_classes = [IsAuthenticated]
    def post(self, request, pk):
        return _proxy_post(f"/attendance/employees/{pk}/reactivate", {})
    

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
