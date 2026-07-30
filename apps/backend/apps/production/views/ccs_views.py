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
 
def _infer_shift(hours, turno, status):
    if status == "absent" or float(hours) == 0:
        return "none"
    full_h = 11.0 if turno == "B" else 12.0
    h = float(hours)
    if h >= full_h:
        return "full"
    if h >= 8:
        return "overtime"
    return "partial"
 
 
class CcsAttendanceDailyView(APIView):
    permission_classes = [IsAuthenticated]
 
    def get(self, request):
        from apps.production.models import PlantEmployee, CcsAttendanceRecord
        date_str = request.query_params.get("date")
        turno    = request.query_params.get("turno")
 
        qs = PlantEmployee.objects.filter(is_active=True)
        if turno:
            qs = qs.filter(turno=turno)
        qs = qs.order_by("name")
 
        att_map = {}
        if date_str:
            att_map = {
                r.ccs_employee_id: r
                for r in CcsAttendanceRecord.objects.filter(date=date_str)
            }
 
        result = []
        for emp in qs:
            rec    = att_map.get(emp.id)
            status = rec.status if rec else "present"
            hours  = str(rec.hours) if rec else "12.00"
            result.append({
                "employee_id":   emp.id,
                "employee_name": emp.name,
                "turno":         emp.turno,
                "barcode_id":    emp.barcode_id,
                "date":          date_str,
                "status":        status,
                "shift":         _infer_shift(hours, emp.turno, status),
                "hours":         hours,
                "id":            rec.id if rec else None,
                "recorded_at":   rec.recorded_at.isoformat() if rec else None,
            })
        return Response(result)
 
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
 
 
def _employee_dict(emp):
    return {
        "id":         emp.id,
        "barcode_id": emp.barcode_id,
        "name":       emp.name,
        "department": emp.department,
        "turno":      emp.turno,
        "is_active":  emp.is_active,
        "created_at": emp.created_at,
    }
 
 
class CcsEmployeesView(APIView):
    permission_classes = [IsAuthenticated]
 
    def get(self, request):
        from apps.production.models import PlantEmployee
        include_inactive = request.query_params.get("include_inactive") in ("true", "1", "True")
        qs = PlantEmployee.objects.all()
        if not include_inactive:
            qs = qs.filter(is_active=True)
        department = request.query_params.get("department")
        if department:
            qs = qs.filter(department=department)
        return Response({"data": [_employee_dict(e) for e in qs.order_by("name")]})
 
    def post(self, request):
        from apps.production.models import PlantEmployee
        emp = PlantEmployee.objects.create(
            name=request.data.get("name", ""),
            department=request.data.get("department", "Assembly"),
            turno=request.data.get("turno", "A"),
            barcode_id=request.data.get("barcode_id", ""),
        )
        return Response(_employee_dict(emp))
 
 
class CcsEmployeeDetailView(APIView):
    permission_classes = [IsAuthenticated]
 
    def patch(self, request, pk):
        from apps.production.models import PlantEmployee
        try:
            emp = PlantEmployee.objects.get(pk=pk)
        except PlantEmployee.DoesNotExist:
            return Response({"error": "Not found"}, status=http_status.HTTP_404_NOT_FOUND)
        for field in ("name", "department", "turno", "barcode_id"):
            if field in request.data:
                setattr(emp, field, request.data[field])
        emp.save()
        return Response(_employee_dict(emp))
 
    def delete(self, request, pk):
        from apps.production.models import PlantEmployee
        try:
            emp = PlantEmployee.objects.get(pk=pk)
        except PlantEmployee.DoesNotExist:
            return Response({"error": "Not found"}, status=http_status.HTTP_404_NOT_FOUND)
        emp.is_active = False
        emp.save(update_fields=["is_active"])
        return Response(_employee_dict(emp))
 
 
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