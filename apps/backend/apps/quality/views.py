from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from rest_framework import status
from .models import QualityTarget
from .serializers import QualityTargetSerializer
from .services.quality_service import QualityService
from apps.warehouse.services.plex_client import PlexProxyError
from datetime import date, timedelta
from apps.quality.services.qwall_service import QWallService

from openpyxl import Workbook
from openpyxl.styles import Font, PatternFill, Alignment, Border, Side
from datetime import date, timedelta, datetime as dt

from .services.rejection_service import RejectionService

from .services.rejection_pdf_service import build_rejection_pdf
from .repositories.rejection_repository import RejectionRepository

import os
import requests
from django.core.cache import cache
from datetime import date, timedelta
import io
from openpyxl import Workbook
from openpyxl.styles import Font, PatternFill, Alignment
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from django.http import HttpResponse
from apps.quality.services.qwall_service import QWallService
PROXY_URL  = os.getenv("QWALL_PROXY_URL",   "http://host.docker.internal:8002")
HEADERS    = {"Authorization": f"Bearer {os.getenv('QWALL_PROXY_TOKEN', '')}"}

class ScrapDetailView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        start     = request.query_params.get("start_date")
        end       = request.query_params.get("end_date")
        use_shift = request.query_params.get("use_shift", "true").lower() == "true"

        if not start or not end:
            return Response({"detail": "start_date y end_date requeridos."}, status=400)
        try:
            data = QualityService().get_scrap_detail(start, end, use_shift)
            return Response(data)
        except PlexProxyError as e:
            return Response({"detail": str(e)}, status=502)


class QualityTargetView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        targets = QualityTarget.objects.all().order_by("level", "bu", "workcenter_name")
        return Response(QualityTargetSerializer(targets, many=True).data)

    def post(self, request):
        serializer = QualityTargetSerializer(data=request.data)
        if not serializer.is_valid():
            return Response(serializer.errors, status=400)
        serializer.save(updated_by=request.user)
        return Response(serializer.data, status=201)

    def put(self, request, pk: int):
        try:
            target = QualityTarget.objects.get(pk=pk)
        except QualityTarget.DoesNotExist:
            return Response({"detail": "No encontrado."}, status=404)
        serializer = QualityTargetSerializer(target, data=request.data, partial=True)
        if not serializer.is_valid():
            return Response(serializer.errors, status=400)
        serializer.save(updated_by=request.user)
        return Response(serializer.data)

    def delete(self, request, pk: int):
        try:
            QualityTarget.objects.get(pk=pk).delete()
        except QualityTarget.DoesNotExist:
            return Response({"detail": "No encontrado."}, status=404)
        return Response(status=204)
    



class QWallReportView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        today        = date.today()
        start_raw    = request.query_params.get("start_date", str(today - timedelta(days=7)))
        end_raw      = request.query_params.get("end_date",   str(today))
        fmt          = request.query_params.get("export",       "json")
        include_test = request.query_params.get("include_test", "false").lower() == "true"

        try:
            start_date = date.fromisoformat(start_raw)
            end_date   = date.fromisoformat(end_raw)
        except ValueError:
            return Response({"error": "Formato de fecha inválido. Use YYYY-MM-DD."}, status=400)

        if end_date < start_date:
            return Response({"error": "end_date no puede ser anterior a start_date."}, status=400)

        if (end_date - start_date).days > 180:
            return Response({"error": "Rango máximo permitido: 180 días."}, status=400)

        data = QWallService.get_report(start_date, end_date, include_test=include_test)

        if fmt == "xlsx":
            try:
                xlsx     = _build_excel(data, start_date, end_date, include_test=include_test)
                filename = f"qwall_{start_raw}_{end_raw}{'_test' if include_test else ''}.xlsx"
                response = HttpResponse(
                    xlsx,
                    content_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
                )
                response["Content-Disposition"] = f'attachment; filename="{filename}"'
                return response
            except Exception as e:
                import traceback
                return Response({"error": str(e), "trace": traceback.format_exc()}, status=500)

        return Response(data)

# ── Excel builder ─────────────────────────────────────────────────────────────

HEADER_FILL = PatternFill(start_color="4472C4", end_color="4472C4", fill_type="solid")
HEADER_FONT = Font(bold=True, color="FFFFFF")
FAIL_FONT   = Font(color="FF0000", bold=True)
BOLD_LG     = Font(bold=True, size=12)
BOLD        = Font(bold=True)
CENTER      = Alignment(horizontal="center", vertical="center")


def _fmt_duration(seconds) -> str:
    if not seconds:
        return "0:00"
    s = int(seconds)
    return f"{s // 60}:{str(s % 60).zfill(2)}"


def _build_excel(data: dict, start_date: date, end_date: date, include_test: bool = False) -> bytes:
    wb = Workbook()

    # ── Hoja 1: Resumen ───────────────────────────────────────────────────────
    ws_sum = wb.active
    ws_sum.title = "Resumen"

    summary = data["summary"]
    avg_dur = _fmt_duration(summary["avg_duration"])
    by_part = sorted(data.get("by_part", []), key=lambda x: x["total"], reverse=True)

    thin       = Side(style="thin", color="000000")
    border     = Border(left=thin, right=thin, top=thin, bottom=thin)
    title_fill = PatternFill(start_color="D9E1F2", end_color="D9E1F2", fill_type="solid")
    no_fill    = PatternFill(fill_type=None)
    center     = Alignment(horizontal="center", vertical="center")

    total_cols = 2 + len(by_part)

    ws_sum.column_dimensions["A"].width = 26
    ws_sum.column_dimensions["B"].width = 16
    for i in range(len(by_part)):
        col_letter = ws_sum.cell(row=1, column=3 + i).column_letter
        ws_sum.column_dimensions[col_letter].width = 16

    # Fila 1: Título
    titulo = "Reporte de Inspecciones — PRUEBAS" if include_test else "Reporte de Inspecciones de Calidad"
    ws_sum.merge_cells(start_row=1, start_column=1, end_row=1, end_column=total_cols)
    t           = ws_sum.cell(row=1, column=1, value=titulo)
    t.font      = Font(bold=True, size=12)
    t.fill      = title_fill
    t.alignment = center
    t.border    = border
    for c in range(2, total_cols + 1):
        ws_sum.cell(row=1, column=c).border = border
    ws_sum.row_dimensions[1].height = 22

    # Fila 2: Sub-headers
    ws_sum.row_dimensions[2].height = 18
    ws_sum.cell(row=2, column=1).border = border
    ws_sum.cell(row=2, column=1).fill   = title_fill

    total_hdr           = ws_sum.cell(row=2, column=2, value="Total")
    total_hdr.font      = Font(bold=True, size=10)
    total_hdr.fill      = title_fill
    total_hdr.alignment = center
    total_hdr.border    = border

    for i, part in enumerate(by_part):
        cell           = ws_sum.cell(row=2, column=3 + i, value=part["part_number"])
        cell.font      = Font(bold=True, size=10)
        cell.fill      = title_fill
        cell.alignment = center
        cell.border    = border

    # Filas de datos
    rows_data = [
        ("Período",               f"{start_date} a {end_date}",          None,        None),
        ("Generado",              dt.now().strftime("%Y-%m-%d %H:%M:%S"), None,        None),
        ("Total de Inspecciones", summary["total"],                       "total",     None),
        ("PASS",                  summary["pass"],                        "pass",      False),
        ("FAIL",                  summary["fail"],                        "fail",      True),
        ("Tasa de Aprobación",    f"{summary['pass_rate']:.2f}%",         "pass_rate", None),
        ("Tiempo Promedio",       avg_dur,                                None,        None),
        ("Inspectores Únicos",    summary["inspectors"],                  None,        None),
        ("Part Numbers Únicos",   summary["part_numbers"],                None,        None),
    ]

    for i, (label, value, part_field, is_fail_field) in enumerate(rows_data, start=3):
        ws_sum.row_dimensions[i].height = 18
        fill = title_fill if i % 2 == 0 else no_fill

        a           = ws_sum.cell(row=i, column=1, value=label)
        a.font      = Font(size=10)
        a.alignment = center
        a.border    = border
        a.fill      = fill

        b           = ws_sum.cell(row=i, column=2, value=value)
        b.font      = Font(size=10)
        b.alignment = center
        b.border    = border
        b.fill      = fill

        for j, part in enumerate(by_part):
            cell           = ws_sum.cell(row=i, column=3 + j)
            cell.alignment = center
            cell.border    = border
            cell.fill      = fill

            if part_field and part_field in part:
                val = part[part_field]
                if part_field == "pass_rate":
                    val = f"{val:.1f}%"
                cell.value = val
                if is_fail_field and isinstance(val, (int, float)) and val > 0:
                    cell.font = Font(size=10, color="C00000", bold=True)
                else:
                    cell.font = Font(size=10)
            else:
                cell.value = ""
                cell.font  = Font(size=10)

    # ── Hoja 2: Inspecciones ──────────────────────────────────────────────────
    ws = wb.create_sheet("Inspecciones")

    columns = [
        ("Fecha",        "inspection_date", 14),
        ("Semana",       "week_number",     10),
        ("Mes",          "month_name",      14),
        ("Hora Inicio",  "time_start",      12),
        ("Hora Fin",     "time_end",        12),
        ("Duración",     "_duration",       12),
        ("Inspector",    "inspector",       22),
        ("Tipo",         "inspection_type", 16),
        ("Resultado",    "result",          12),
        ("QTY",          "_qty",            8),
        ("WO",           "work_order",      14),
        ("Part Number",  "part_number",     20),
        ("Serial SSI",   "serial_ssi",      20),
        ("Serial Volvo", "serial_volvo",    20),
        ("Fallas",       "fail_modes",      40),
    ]

    for col_idx, (header, _, width) in enumerate(columns, start=1):
        cell            = ws.cell(row=1, column=col_idx, value=header)
        cell.fill       = HEADER_FILL
        cell.font       = HEADER_FONT
        cell.alignment  = CENTER
        ws.column_dimensions[ws.cell(row=1, column=col_idx).column_letter].width = width

    rows = data.get("rows", [])
    for row_idx, r in enumerate(rows, start=2):
        values = []
        for _, field, _ in columns:
            if field == "_duration":
                values.append(_fmt_duration(r.get("duration_seconds")))
            elif field == "_qty":
                values.append(1)
            else:
                values.append(r.get(field, ""))

        for col_idx, val in enumerate(values, start=1):
            cell = ws.cell(row=row_idx, column=col_idx, value=val)
            if columns[col_idx - 1][0] == "Resultado":
                if val == "FAIL":
                    cell.font = FAIL_FONT
            if r.get("result") == "FAIL":
                cell.fill = PatternFill(start_color="FFE5E5", end_color="FFE5E5", fill_type="solid")

    # ── Pivot de fallas ───────────────────────────────────────────────────────
    fail_modes = data.get("fail_modes", [])
    if fail_modes:
        pivot_col = len(columns) + 2

        title_cell      = ws.cell(row=1, column=pivot_col, value="ANÁLISIS DE FALLAS")
        title_cell.font = BOLD_LG

        hdr_falla = ws.cell(row=2, column=pivot_col,     value="Falla")
        hdr_cant  = ws.cell(row=2, column=pivot_col + 1, value="Cantidad")
        for cell in [hdr_falla, hdr_cant]:
            cell.fill      = HEADER_FILL
            cell.font      = HEADER_FONT
            cell.alignment = CENTER

        piv_col_letter      = ws.cell(row=1, column=pivot_col).column_letter
        piv_col_next_letter = ws.cell(row=1, column=pivot_col + 1).column_letter
        ws.column_dimensions[piv_col_letter].width      = 50
        ws.column_dimensions[piv_col_next_letter].width = 12

        for i, fm in enumerate(fail_modes, start=3):
            ws.cell(row=i, column=pivot_col,     value=fm["fail_mode"])
            ws.cell(row=i, column=pivot_col + 1, value=fm["count"])

        total_row  = len(fail_modes) + 3
        total_cell = ws.cell(row=total_row, column=pivot_col, value="TOTAL")
        total_cell.font = BOLD_LG
        sum_cell = ws.cell(
            row=total_row, column=pivot_col + 1,
            value=f"=SUM({piv_col_next_letter}3:{piv_col_next_letter}{total_row - 1})"
        )
        sum_cell.font      = BOLD_LG
        sum_cell.alignment = CENTER

    # ── Output ────────────────────────────────────────────────────────────────
    buf = io.BytesIO()
    wb.save(buf)
    buf.seek(0)
    return buf.getvalue()

class RejectionReportView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        start        = request.query_params.get("start_date")
        end          = request.query_params.get("end_date")
        bu_id        = request.query_params.get("bu_id")
        include_test = request.query_params.get("include_test", "false").lower() == "true"

        if not start or not end:
            return Response({"detail": "start_date y end_date requeridos."}, status=400)

        try:
            data = RejectionService().get_tree(
                start, end, int(bu_id) if bu_id else None, include_test=include_test
            )
            return Response(data)
        except Exception as e:
            return Response({"detail": str(e)}, status=502)

class RejectionPhotoView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request, inspection_id: int):
        try:
            data = RejectionService().get_photo(inspection_id)
            return Response(data)
        except Exception as e:
            return Response({"detail": str(e)}, status=502)
        
class RejectionReportPDFView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        start = request.query_params.get("start_date")
        end   = request.query_params.get("end_date")
        bu_id = request.query_params.get("bu_id")
        lang  = request.query_params.get("lang", "es")   # ← agregar
        if lang not in ("es", "en"):
            lang = "es"

        if not start or not end:
            return Response({"detail": "start_date y end_date requeridos."}, status=400)

        try:
            svc  = RejectionService()
            tree = svc.get_tree(start, end, int(bu_id) if bu_id else None)

            repo = RejectionRepository()
            for node in tree:
                for serial in node["serials"]:
                    for insp in serial["inspections"]:
                        if insp.get("has_photo"):
                            try:
                                photo = repo.get_rejection_photo(insp["inspection_id"])
                                insp["photo_b64"] = photo.get("photo_b64")
                            except Exception:
                                insp["photo_b64"] = None
                        else:
                            insp["photo_b64"] = None

            pdf_bytes = build_rejection_pdf(tree, start, end, lang)   # ← pasar lang

            filename = f"rechazos_{start}_{end}.pdf"
            response = HttpResponse(pdf_bytes, content_type="application/pdf")
            response["Content-Disposition"] = f'attachment; filename="{filename}"'
            return response

        except Exception as e:
            return Response({"detail": str(e)}, status=502)
        
# apps/backend/apps/quality/views.py — agregar

class QWallPartNumbersView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        cache_key = "qwall:part_numbers_catalog"
        cached    = cache.get(cache_key)
        if cached:
            return Response(cached)
        try:
            resp = requests.get(
                f"{PROXY_URL}/part-numbers",
                headers=HEADERS,
                timeout=15,
            )
            resp.raise_for_status()
            data = resp.json().get("data", [])
            cache.set(cache_key, data, 3600)  # 1 hora — catálogo estático
            return Response(data)
        except Exception as e:
            return Response({"detail": str(e)}, status=502)
        
"""
Problem Control Views - DRF ViewSets and API endpoints.
"""
from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated

from .models import Problem, Stage, AuditLog, SLASettings
from .serializers import (
    ProblemListSerializer,
    ProblemDetailSerializer,
    ProblemCreateSerializer,
    ProblemUpdateSerializer,
    StageSerializer,
    StageUpdateSerializer,
    ApprovalSerializer,
    OverrideRequestSerializer,
    AuditLogSerializer,
    SLASettingsSerializer,
)
from .services.problem_service import ProblemService
from .repositories.problem_repository import ProblemRepository, StageRepository


class ProblemViewSet(viewsets.ModelViewSet):
    """
    ViewSet for Problem CRUD and workflow actions.
    """
    permission_classes = [IsAuthenticated]
    
    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        self.service = ProblemService()
        self.repository = ProblemRepository()
    
    def get_queryset(self):
        """Filter problems based on user role."""
        filters = {
            'status': self.request.query_params.get('status'),
            'severity': self.request.query_params.get('severity'),
            'search': self.request.query_params.get('search'),
            'created_by': self.request.query_params.get('created_by'),
        }
        # Remove None values
        filters = {k: v for k, v in filters.items() if v is not None}
        
        return self.repository.list_for_user(
            user=self.request.user,
            filters=filters
        )
    
    def get_serializer_class(self):
        """Return appropriate serializer based on action."""
        if self.action == 'list':
            return ProblemListSerializer
        elif self.action == 'create':
            return ProblemCreateSerializer
        elif self.action in ['update', 'partial_update']:
            return ProblemUpdateSerializer
        return ProblemDetailSerializer
    
    def create(self, request):
        """Create new problem in DRAFT status."""
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        
        problem = self.service.create_draft(
            data=serializer.validated_data,
            user=request.user,
            request_meta=self._get_request_meta(request)
        )
        
        output_serializer = ProblemDetailSerializer(problem)
        return Response(output_serializer.data, status=status.HTTP_201_CREATED)
    
    def update(self, request, pk=None):
        """Update problem (only drafts allowed)."""
        serializer = self.get_serializer(data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        
        try:
            problem = self.service.update_draft(
                problem_id=pk,
                data=serializer.validated_data,
                user=request.user,
                request_meta=self._get_request_meta(request)
            )
            output_serializer = ProblemDetailSerializer(problem)
            return Response(output_serializer.data)
        except ValueError as e:
            return Response(
                {'error': str(e)},
                status=status.HTTP_400_BAD_REQUEST
            )
    
    def destroy(self, request, pk=None):
        """Delete problem (only drafts allowed)."""
        try:
            self.repository.delete(pk)
            return Response(status=status.HTTP_204_NO_CONTENT)
        except ValueError as e:
            return Response(
                {'error': str(e)},
                status=status.HTTP_400_BAD_REQUEST
            )
    
    @action(detail=True, methods=['post'])
    def submit(self, request, pk=None):
        """Submit problem for manager approval."""
        try:
            problem = self.service.submit_for_approval(
                problem_id=pk,
                user=request.user,
                request_meta=self._get_request_meta(request)
            )
            serializer = ProblemDetailSerializer(problem)
            return Response(serializer.data)
        except ValueError as e:
            return Response(
                {'error': str(e)},
                status=status.HTTP_400_BAD_REQUEST
            )
    
    @action(detail=True, methods=['post'])
    def approve(self, request, pk=None):
        """Approve problem (Manager only)."""
        user_role = self._get_user_role(request.user)
        if user_role != 'manager':
            return Response(
                {'error': 'Only managers can approve problems'},
                status=status.HTTP_403_FORBIDDEN
            )
        
        try:
            problem = self.service.approve_problem(
                problem_id=pk,
                approver=request.user,
                request_meta=self._get_request_meta(request)
            )
            serializer = ProblemDetailSerializer(problem)
            return Response(serializer.data)
        except ValueError as e:
            return Response(
                {'error': str(e)},
                status=status.HTTP_400_BAD_REQUEST
            )
    
    @action(detail=True, methods=['post'])
    def reject(self, request, pk=None):
        """Reject problem (Manager only)."""
        user_role = self._get_user_role(request.user)
        if user_role != 'manager':
            return Response(
                {'error': 'Only managers can reject problems'},
                status=status.HTTP_403_FORBIDDEN
            )
        
        serializer = ApprovalSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        
        reason = serializer.validated_data.get('reason', '')
        if not reason:
            return Response(
                {'error': 'Reason is required for rejection'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        try:
            problem = self.service.reject_problem(
                problem_id=pk,
                reason=reason,
                rejector=request.user,
                request_meta=self._get_request_meta(request)
            )
            output_serializer = ProblemDetailSerializer(problem)
            return Response(output_serializer.data)
        except ValueError as e:
            return Response(
                {'error': str(e)},
                status=status.HTTP_400_BAD_REQUEST
            )
    
    @action(detail=True, methods=['post'])
    def close(self, request, pk=None):
        """Close problem (requires all stages completed)."""
        try:
            problem = self.service.close_problem(
                problem_id=pk,
                user=request.user,
                request_meta=self._get_request_meta(request)
            )
            serializer = ProblemDetailSerializer(problem)
            return Response(serializer.data)
        except ValueError as e:
            return Response(
                {'error': str(e)},
                status=status.HTTP_400_BAD_REQUEST
            )
    
    @action(detail=True, methods=['get'])
    def audit_log(self, request, pk=None):
        """Get audit log for problem."""
        problem = self.get_object()
        logs = AuditLog.objects.filter(problem=problem).order_by('-created_at')
        serializer = AuditLogSerializer(logs, many=True)
        return Response(serializer.data)
    
    def _get_request_meta(self, request):
        """Extract request metadata for audit."""
        return {
            'ip_address': self._get_client_ip(request),
            'user_agent': request.META.get('HTTP_USER_AGENT', '')
        }
    
    def _get_client_ip(self, request):
        """Extract client IP from request."""
        x_forwarded_for = request.META.get('HTTP_X_FORWARDED_FOR')
        if x_forwarded_for:
            return x_forwarded_for.split(',')[0]
        return request.META.get('REMOTE_ADDR')
    
    def _get_user_role(self, user):
        """Get user role from job_title."""
        if hasattr(user, 'job_title') and user.job_title:
            return user.job_title.lower()
        return 'viewer'


class StageViewSet(viewsets.ModelViewSet):
    """ViewSet for Stage operations."""
    permission_classes = [IsAuthenticated]
    serializer_class = StageSerializer
    
    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        self.repository = StageRepository()
    
    def get_queryset(self):
        """Get stages (filtered by problem if provided)."""
        qs = Stage.objects.select_related('problem', 'assigned_to')
        problem_id = self.request.query_params.get('problem_id')
        if problem_id:
            qs = qs.filter(problem_id=problem_id)
        return qs
    
    def update(self, request, pk=None):
        """Update stage data."""
        serializer = StageUpdateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        
        stage = self.repository.get_by_id(pk)
        
        # Check if can edit
        if stage.is_overdue and not stage.override_approved:
            return Response(
                {'error': 'Override required to edit overdue stage'},
                status=status.HTTP_403_FORBIDDEN
            )
        
        # Update data
        if 'data' in serializer.validated_data:
            stage = self.repository.update_data(
                stage_id=pk,
                data=serializer.validated_data['data']
            )
        
        # Complete if requested
        if serializer.validated_data.get('complete'):
            stage = self.repository.complete_stage(
                stage_id=pk,
                user=request.user
            )
            
            # Audit log
            AuditLog.log_change(
                entity=stage,
                action=AuditLog.Action.STAGE_COMPLETED,
                user=request.user,
                changes={'completed_by': request.user.get_full_name()}
            )
        
        output_serializer = StageSerializer(stage, context={'request': request})
        return Response(output_serializer.data)
    
    @action(detail=True, methods=['post'])
    def complete(self, request, pk=None):
        """Mark stage as completed."""
        stage = self.repository.get_by_id(pk)
        
        if stage.is_overdue and not stage.override_approved:
            return Response(
                {'error': 'Override required to complete overdue stage'},
                status=status.HTTP_403_FORBIDDEN
            )
        
        stage = self.repository.complete_stage(pk, request.user)
        
        # Audit log
        AuditLog.log_change(
            entity=stage,
            action=AuditLog.Action.STAGE_COMPLETED,
            user=request.user,
            changes={'completed_by': request.user.get_full_name()}
        )
        
        serializer = StageSerializer(stage, context={'request': request})
        return Response(serializer.data)
    
    @action(detail=True, methods=['post'], url_path='request-override')
    def request_override(self, request, pk=None):
        """Request override for overdue stage."""
        serializer = OverrideRequestSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        
        stage = self.repository.get_by_id(pk)
        
        if not stage.is_overdue:
            return Response(
                {'error': 'Stage is not overdue'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        stage.request_override(
            reason=serializer.validated_data['reason'],
            user=request.user
        )
        
        output_serializer = StageSerializer(stage, context={'request': request})
        return Response(output_serializer.data)
    
    @action(detail=True, methods=['post'], url_path='approve-override')
    def approve_override(self, request, pk=None):
        """Approve override request (Manager only)."""
        user_role = request.user.job_title.lower() if hasattr(request.user, 'job_title') else None
        if user_role != 'manager':
            return Response(
                {'error': 'Only managers can approve overrides'},
                status=status.HTTP_403_FORBIDDEN
            )
        
        stage = self.repository.get_by_id(pk)
        
        if not stage.override_requested:
            return Response(
                {'error': 'No override request pending'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        stage.approve_override(user=request.user)
        
        serializer = StageSerializer(stage, context={'request': request})
        return Response(serializer.data)


class SLASettingsViewSet(viewsets.ViewSet):
    """ViewSet for SLA settings (singleton)."""
    permission_classes = [IsAuthenticated]
    
    def list(self, request):
        """Get current SLA settings."""
        settings = SLASettings.get_current()
        serializer = SLASettingsSerializer(settings)
        return Response(serializer.data)
    
    def update(self, request):
        """Update SLA settings (Manager only)."""
        user_role = request.user.job_title.lower() if hasattr(request.user, 'job_title') else None
        if user_role != 'manager':
            return Response(
                {'error': 'Only managers can update SLA settings'},
                status=status.HTTP_403_FORBIDDEN
            )
        
        settings = SLASettings.get_current()
        serializer = SLASettingsSerializer(settings, data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        
        # Update
        for field, value in serializer.validated_data.items():
            setattr(settings, field, value)
        settings.updated_by = request.user
        settings.save()
        
        output_serializer = SLASettingsSerializer(settings)
        return Response(output_serializer.data)