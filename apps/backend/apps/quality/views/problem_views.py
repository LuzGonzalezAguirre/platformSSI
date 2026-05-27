# apps/quality/views/problem_views.py
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from rest_framework import status
from django.core.exceptions import PermissionDenied, ValidationError

from apps.quality.services.problem_service import ProblemService
from apps.quality.serializers import (
    ProblemListSerializer,
    ProblemDetailSerializer,
    ProblemCreateSerializer,
    SeverityLevelSerializer,
    DefectTypeSerializer,
)
from apps.quality.models import (
    ContainmentAction, FiveWhyAnalysis, RootCause,
    CorrectiveAction, VerificationAction, PreventionAction,
)
from apps.quality.serializers.problem_serializer import (
    ContainmentActionSerializer,
    FiveWhyAnalysisSerializer,
    RootCauseSerializer,
    CorrectiveActionSerializer,
    VerificationActionSerializer,
    PreventionActionSerializer,
)


class ProblemListCreateView(APIView):
    """
    GET: Lista de problems con filtros
    POST: Crear nuevo problem (Draft)
    """
    permission_classes = [IsAuthenticated]

    def get(self, request):
        """
        Lista problems con filtros opcionales.
        Query params:
        - status: draft|pending_approval|approved|closed|rejected
        - customer_no: filtrar por customer
        - category: filtrar por categoría
        - severity_level: filtrar por nivel (0-10)
        - champion_id: filtrar por champion
        - start_date: filtrar desde fecha (YYYY-MM-DD)
        - end_date: filtrar hasta fecha (YYYY-MM-DD)
        - overdue: true|false
        """
        try:
            filters = {
                'status': request.query_params.get('status'),
                'customer_no': request.query_params.get('customer_no'),
                'category': request.query_params.get('category'),
                'severity_level': request.query_params.get('severity_level'),
                'champion_id': request.query_params.get('champion_id'),
                'start_date': request.query_params.get('start_date'),
                'end_date': request.query_params.get('end_date'),
                'overdue': request.query_params.get('overdue', '').lower() == 'true',
            }

            # Remover filtros None
            filters = {k: v for k, v in filters.items() if v is not None and v != ''}

            problems = ProblemService.get_all_problems(filters, request.user)
            serializer = ProblemListSerializer(problems, many=True)
            return Response(serializer.data)

        except PermissionDenied as e:
            return Response({'detail': str(e)}, status=status.HTTP_403_FORBIDDEN)
        except Exception as e:
            return Response({'detail': str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

    def post(self, request):
        """
        Crear nuevo problem en Draft.
        Required fields:
        - brief_description
        - full_description
        - problem_type
        - severity_level_id
        - champion_id
        - date_of_occurrence
        """
        try:
            serializer = ProblemCreateSerializer(data=request.data)
            if not serializer.is_valid():
                return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

            problem = ProblemService.create_problem(
                serializer.validated_data,
                request.user
            )

            detail_serializer = ProblemDetailSerializer(problem)
            return Response(detail_serializer.data, status=status.HTTP_201_CREATED)

        except PermissionDenied as e:
            return Response({'detail': str(e)}, status=status.HTTP_403_FORBIDDEN)
        except ValidationError as e:
            return Response({'detail': str(e)}, status=status.HTTP_400_BAD_REQUEST)
        except Exception as e:
            return Response({'detail': str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


class ProblemDetailView(APIView):
    """
    GET: Detalle completo de problem
    PUT: Actualizar problem
    DELETE: Eliminar problem (solo Draft)
    """
    permission_classes = [IsAuthenticated]

    def get(self, request, pk: int):
        """Obtener detalle completo de problem por ID"""
        try:
            problem = ProblemService.get_problem_by_id(pk, request.user)
            serializer = ProblemDetailSerializer(problem)
            return Response(serializer.data)

        except PermissionDenied as e:
            return Response({'detail': str(e)}, status=status.HTTP_403_FORBIDDEN)
        except ValidationError as e:
            return Response({'detail': str(e)}, status=status.HTTP_404_NOT_FOUND)
        except Exception as e:
            return Response({'detail': str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

    def put(self, request, pk: int):
        """Actualizar problem existente"""
        try:
            # Validar con serializer
            problem = ProblemService.get_problem_by_id(pk, request.user)
            serializer = ProblemDetailSerializer(
                problem,
                data=request.data,
                partial=True
            )
            if not serializer.is_valid():
                return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

            # Actualizar vía service
            updated_problem = ProblemService.update_problem(
                pk,
                serializer.validated_data,
                request.user
            )

            result_serializer = ProblemDetailSerializer(updated_problem)
            return Response(result_serializer.data)

        except PermissionDenied as e:
            return Response({'detail': str(e)}, status=status.HTTP_403_FORBIDDEN)
        except ValidationError as e:
            return Response({'detail': str(e)}, status=status.HTTP_400_BAD_REQUEST)
        except Exception as e:
            return Response({'detail': str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

    def delete(self, request, pk: int):
        """Eliminar problem (solo Draft)"""
        try:
            ProblemService.delete_problem(pk, request.user)
            return Response(status=status.HTTP_204_NO_CONTENT)

        except PermissionDenied as e:
            return Response({'detail': str(e)}, status=status.HTTP_403_FORBIDDEN)
        except ValidationError as e:
            return Response({'detail': str(e)}, status=status.HTTP_400_BAD_REQUEST)
        except Exception as e:
            return Response({'detail': str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


class ProblemSubmitView(APIView):
    """POST: Submit problem for approval (Draft → Pending Approval)"""
    permission_classes = [IsAuthenticated]

    def post(self, request, pk: int):
        """Submit problem for manager approval"""
        try:
            problem = ProblemService.submit_for_approval(pk, request.user)
            serializer = ProblemDetailSerializer(problem)
            return Response(serializer.data)

        except PermissionDenied as e:
            return Response({'detail': str(e)}, status=status.HTTP_403_FORBIDDEN)
        except ValidationError as e:
            return Response({'detail': str(e)}, status=status.HTTP_400_BAD_REQUEST)
        except Exception as e:
            return Response({'detail': str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


class ProblemApproveView(APIView):
    """POST: Approve problem (Quality Manager only)"""
    permission_classes = [IsAuthenticated]

    def post(self, request, pk: int):
        """
        Approve problem and generate problem_number.
        Request body: {"comments": "optional comments"}
        """
        try:
            comments = request.data.get('comments', '')
            problem = ProblemService.approve_problem(pk, request.user, comments)
            serializer = ProblemDetailSerializer(problem)
            return Response(serializer.data)

        except PermissionDenied as e:
            return Response({'detail': str(e)}, status=status.HTTP_403_FORBIDDEN)
        except ValidationError as e:
            return Response({'detail': str(e)}, status=status.HTTP_400_BAD_REQUEST)
        except Exception as e:
            return Response({'detail': str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


class ProblemRejectView(APIView):
    """POST: Reject problem (Quality Manager only)"""
    permission_classes = [IsAuthenticated]

    def post(self, request, pk: int):
        """
        Reject problem.
        Request body: {"comments": "rejection reason (required)"}
        """
        try:
            comments = request.data.get('comments', '')
            if not comments:
                return Response(
                    {'detail': 'Rejection comments are required'},
                    status=status.HTTP_400_BAD_REQUEST
                )

            problem = ProblemService.reject_problem(pk, request.user, comments)
            serializer = ProblemDetailSerializer(problem)
            return Response(serializer.data)

        except PermissionDenied as e:
            return Response({'detail': str(e)}, status=status.HTTP_403_FORBIDDEN)
        except ValidationError as e:
            return Response({'detail': str(e)}, status=status.HTTP_400_BAD_REQUEST)
        except Exception as e:
            return Response({'detail': str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


class ProblemCloseView(APIView):
    """POST: Close problem after validations"""
    permission_classes = [IsAuthenticated]

    def post(self, request, pk: int):
        """
        Close problem.
        Validates:
        - FMEA/Control Plan completion
        - Five Why completeness
        - Root Causes count
        - Corrective Actions per Root Cause
        """
        try:
            problem = ProblemService.close_problem(pk, request.user)
            serializer = ProblemDetailSerializer(problem)
            return Response(serializer.data)

        except PermissionDenied as e:
            return Response({'detail': str(e)}, status=status.HTTP_403_FORBIDDEN)
        except ValidationError as e:
            return Response({'detail': str(e)}, status=status.HTTP_400_BAD_REQUEST)
        except Exception as e:
            return Response({'detail': str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


class ProblemOverrideRequestView(APIView):
    """POST: Request override for globally overdue problem"""
    permission_classes = [IsAuthenticated]

    def post(self, request, pk: int):
        """
        Request override approval.
        Request body: {"reason": "why override is needed"}
        """
        try:
            reason = request.data.get('reason', '')
            if not reason:
                return Response(
                    {'detail': 'Override reason is required'},
                    status=status.HTTP_400_BAD_REQUEST
                )

            problem = ProblemService.request_override(pk, request.user, reason)
            serializer = ProblemDetailSerializer(problem)
            return Response(serializer.data)

        except PermissionDenied as e:
            return Response({'detail': str(e)}, status=status.HTTP_403_FORBIDDEN)
        except ValidationError as e:
            return Response({'detail': str(e)}, status=status.HTTP_400_BAD_REQUEST)
        except Exception as e:
            return Response({'detail': str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


class ProblemOverrideApproveView(APIView):
    """POST: Approve override request (Quality Manager only)"""
    permission_classes = [IsAuthenticated]

    def post(self, request, pk: int):
        """Approve override request"""
        try:
            problem = ProblemService.approve_override(pk, request.user)
            serializer = ProblemDetailSerializer(problem)
            return Response(serializer.data)

        except PermissionDenied as e:
            return Response({'detail': str(e)}, status=status.HTTP_403_FORBIDDEN)
        except ValidationError as e:
            return Response({'detail': str(e)}, status=status.HTTP_400_BAD_REQUEST)
        except Exception as e:
            return Response({'detail': str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


# ═════════════════════════════════════════════════════════════════════════
# CATALOG VIEWS
# ═════════════════════════════════════════════════════════════════════════

class SeverityLevelListView(APIView):
    """GET: Lista de severity levels (0-10)"""
    permission_classes = [IsAuthenticated]

    def get(self, request):
        try:
            levels = ProblemService.get_severity_levels()
            serializer = SeverityLevelSerializer(levels, many=True)
            return Response(serializer.data)
        except Exception as e:
            return Response({'detail': str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


class DefectTypeListView(APIView):
    """GET: Lista de defect types (activos)"""
    permission_classes = [IsAuthenticated]

    def get(self, request):
        try:
            defect_types = ProblemService.get_defect_types()
            serializer = DefectTypeSerializer(defect_types, many=True)
            return Response(serializer.data)
        except Exception as e:
            return Response({'detail': str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


class QualityUsersListView(APIView):
    """
    GET endpoint para obtener usuarios con rol Quality.
    """
    permission_classes = [IsAuthenticated]

    def get(self, request):
        try:
            from apps.quality.repositories.problem_repository import ProblemRepository
            
            # CAMBIAR 'quality' por 'quality_engineer'
            users = ProblemRepository.get_users_by_role('quality_engineer')
            
            from apps.quality.serializers.problem_serializer import UserBasicSerializer
            serializer = UserBasicSerializer(users, many=True)
            
            return Response(serializer.data)
        except Exception as e:
            import traceback
            traceback.print_exc()
            return Response({"detail": str(e)}, status=500)


class QualityManagersListView(APIView):
    """GET: Lista de Quality Managers (para approval workflow)"""
    permission_classes = [IsAuthenticated]

    def get(self, request):
        try:
            from apps.quality.serializers.problem_serializer import UserBasicSerializer
            managers = ProblemService.get_quality_managers()
            serializer = UserBasicSerializer(managers, many=True)
            return Response(serializer.data)
        except Exception as e:
            return Response({'detail': str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


class ContainmentActionListCreateView(APIView):
    """
    GET  /quality/containment-actions/?problem_id=<id>
    POST /quality/containment-actions/
    """
    permission_classes = [IsAuthenticated]

    def get(self, request):
        problem_id = request.query_params.get('problem_id')
        qs = ContainmentAction.objects.filter(problem_id=problem_id) if problem_id else ContainmentAction.objects.none()
        return Response(ContainmentActionSerializer(qs, many=True).data)

    def post(self, request):
        serializer = ContainmentActionSerializer(data=request.data)
        if not serializer.is_valid():
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
        serializer.save()
        return Response(serializer.data, status=status.HTTP_201_CREATED)


class ContainmentActionDetailView(APIView):
    """
    PUT    /quality/containment-actions/<id>/
    DELETE /quality/containment-actions/<id>/
    """
    permission_classes = [IsAuthenticated]

    def _get_object(self, pk):
        try:
            return ContainmentAction.objects.get(pk=pk)
        except ContainmentAction.DoesNotExist:
            return None

    def put(self, request, pk):
        obj = self._get_object(pk)
        if not obj:
            return Response({'detail': 'Not found.'}, status=status.HTTP_404_NOT_FOUND)
        serializer = ContainmentActionSerializer(obj, data=request.data, partial=True)
        if not serializer.is_valid():
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
        serializer.save()
        return Response(serializer.data)

    def delete(self, request, pk):
        obj = self._get_object(pk)
        if not obj:
            return Response({'detail': 'Not found.'}, status=status.HTTP_404_NOT_FOUND)
        obj.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)


# ═════════════════════════════════════════════════════════════════════════
# FIVE WHY ANALYSIS (Step 4)
# ═════════════════════════════════════════════════════════════════════════

class FiveWhyAnalysisListCreateView(APIView):
    """
    GET  /quality/five-why-analyses/?problem_id=<id>
    POST /quality/five-why-analyses/
    """
    permission_classes = [IsAuthenticated]

    def get(self, request):
        problem_id = request.query_params.get('problem_id')
        if not problem_id:
            return Response({'detail': 'problem_id requerido'}, status=status.HTTP_400_BAD_REQUEST)
        qs = FiveWhyAnalysis.objects.filter(problem_id=problem_id).prefetch_related('root_causes__created_by')
        return Response(FiveWhyAnalysisSerializer(qs, many=True).data)

    def post(self, request):
        serializer = FiveWhyAnalysisSerializer(data=request.data)
        if not serializer.is_valid():
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
        serializer.save(created_by=request.user)
        return Response(serializer.data, status=status.HTTP_201_CREATED)


class FiveWhyAnalysisDetailView(APIView):
    """
    PUT    /quality/five-why-analyses/<id>/
    DELETE /quality/five-why-analyses/<id>/
    """
    permission_classes = [IsAuthenticated]

    def _get_object(self, pk):
        try:
            return FiveWhyAnalysis.objects.get(pk=pk)
        except FiveWhyAnalysis.DoesNotExist:
            return None

    def put(self, request, pk):
        obj = self._get_object(pk)
        if not obj:
            return Response({'detail': 'Not found.'}, status=status.HTTP_404_NOT_FOUND)
        serializer = FiveWhyAnalysisSerializer(obj, data=request.data, partial=True)
        if not serializer.is_valid():
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
        serializer.save()
        return Response(serializer.data)

    def delete(self, request, pk):
        obj = self._get_object(pk)
        if not obj:
            return Response({'detail': 'Not found.'}, status=status.HTTP_404_NOT_FOUND)
        obj.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)


# ═════════════════════════════════════════════════════════════════════════
# ROOT CAUSE (Step 4 sub-resource)
# ═════════════════════════════════════════════════════════════════════════

class RootCauseListCreateView(APIView):
    """
    GET  /quality/root-causes/?five_why_id=<id>
    POST /quality/root-causes/
    """
    permission_classes = [IsAuthenticated]

    def get(self, request):
        five_why_id = request.query_params.get('five_why_id')
        if not five_why_id:
            return Response({'detail': 'five_why_id requerido'}, status=status.HTTP_400_BAD_REQUEST)
        qs = RootCause.objects.filter(five_why_id=five_why_id).order_by('order')
        return Response(RootCauseSerializer(qs, many=True).data)

    def post(self, request):
        serializer = RootCauseSerializer(data=request.data)
        if not serializer.is_valid():
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
        serializer.save(created_by=request.user)
        return Response(serializer.data, status=status.HTTP_201_CREATED)


class RootCauseDetailView(APIView):
    """
    PUT    /quality/root-causes/<id>/
    DELETE /quality/root-causes/<id>/
    """
    permission_classes = [IsAuthenticated]

    def _get_object(self, pk):
        try:
            return RootCause.objects.get(pk=pk)
        except RootCause.DoesNotExist:
            return None

    def put(self, request, pk):
        obj = self._get_object(pk)
        if not obj:
            return Response({'detail': 'Not found.'}, status=status.HTTP_404_NOT_FOUND)
        serializer = RootCauseSerializer(obj, data=request.data, partial=True)
        if not serializer.is_valid():
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
        serializer.save()
        return Response(serializer.data)

    def delete(self, request, pk):
        obj = self._get_object(pk)
        if not obj:
            return Response({'detail': 'Not found.'}, status=status.HTTP_404_NOT_FOUND)
        obj.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)


# ═════════════════════════════════════════════════════════════════════════
# CORRECTIVE ACTIONS (Step 5)
# ═════════════════════════════════════════════════════════════════════════

class CorrectiveActionListCreateView(APIView):
    """
    GET  /quality/corrective-actions/?problem_id=<id>
    POST /quality/corrective-actions/
    """
    permission_classes = [IsAuthenticated]

    def get(self, request):
        problem_id = request.query_params.get('problem_id')
        qs = (
            CorrectiveAction.objects.filter(problem_id=problem_id).select_related('responsible', 'root_cause')
            if problem_id
            else CorrectiveAction.objects.none()
        )
        return Response(CorrectiveActionSerializer(qs, many=True).data)

    def post(self, request):
        serializer = CorrectiveActionSerializer(data=request.data)
        if not serializer.is_valid():
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
        serializer.save()
        return Response(serializer.data, status=status.HTTP_201_CREATED)


class CorrectiveActionDetailView(APIView):
    """
    PUT    /quality/corrective-actions/<id>/
    DELETE /quality/corrective-actions/<id>/
    """
    permission_classes = [IsAuthenticated]

    def _get_object(self, pk):
        try:
            return CorrectiveAction.objects.get(pk=pk)
        except CorrectiveAction.DoesNotExist:
            return None

    def put(self, request, pk):
        obj = self._get_object(pk)
        if not obj:
            return Response({'detail': 'Not found.'}, status=status.HTTP_404_NOT_FOUND)
        serializer = CorrectiveActionSerializer(obj, data=request.data, partial=True)
        if not serializer.is_valid():
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
        serializer.save()
        return Response(serializer.data)

    def delete(self, request, pk):
        obj = self._get_object(pk)
        if not obj:
            return Response({'detail': 'Not found.'}, status=status.HTTP_404_NOT_FOUND)
        obj.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)


# ═════════════════════════════════════════════════════════════════════════
# VERIFICATION ACTIONS (Step 6)
# ═════════════════════════════════════════════════════════════════════════

class VerificationActionListCreateView(APIView):
    """
    GET  /quality/verification-actions/?problem_id=<id>
    POST /quality/verification-actions/
    """
    permission_classes = [IsAuthenticated]

    def get(self, request):
        problem_id = request.query_params.get('problem_id')
        qs = (
            VerificationAction.objects.filter(problem_id=problem_id).select_related('responsible')
            if problem_id
            else VerificationAction.objects.none()
        )
        return Response(VerificationActionSerializer(qs, many=True).data)

    def post(self, request):
        serializer = VerificationActionSerializer(data=request.data)
        if not serializer.is_valid():
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
        serializer.save()
        return Response(serializer.data, status=status.HTTP_201_CREATED)


class VerificationActionDetailView(APIView):
    """
    PUT    /quality/verification-actions/<id>/
    DELETE /quality/verification-actions/<id>/
    """
    permission_classes = [IsAuthenticated]

    def _get_object(self, pk):
        try:
            return VerificationAction.objects.get(pk=pk)
        except VerificationAction.DoesNotExist:
            return None

    def put(self, request, pk):
        obj = self._get_object(pk)
        if not obj:
            return Response({'detail': 'Not found.'}, status=status.HTTP_404_NOT_FOUND)
        serializer = VerificationActionSerializer(obj, data=request.data, partial=True)
        if not serializer.is_valid():
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
        serializer.save()
        return Response(serializer.data)

    def delete(self, request, pk):
        obj = self._get_object(pk)
        if not obj:
            return Response({'detail': 'Not found.'}, status=status.HTTP_404_NOT_FOUND)
        obj.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)


# ═════════════════════════════════════════════════════════════════════════
# PREVENTION ACTIONS (Step 7)
# ═════════════════════════════════════════════════════════════════════════

class PreventionActionListCreateView(APIView):
    """
    GET  /quality/prevention-actions/?problem_id=<id>
    POST /quality/prevention-actions/
    """
    permission_classes = [IsAuthenticated]

    def get(self, request):
        problem_id = request.query_params.get('problem_id')
        qs = (
            PreventionAction.objects.filter(problem_id=problem_id).select_related('responsible')
            if problem_id
            else PreventionAction.objects.none()
        )
        return Response(PreventionActionSerializer(qs, many=True).data)

    def post(self, request):
        serializer = PreventionActionSerializer(data=request.data)
        if not serializer.is_valid():
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
        serializer.save()
        return Response(serializer.data, status=status.HTTP_201_CREATED)


class PreventionActionDetailView(APIView):
    """
    PUT    /quality/prevention-actions/<id>/
    DELETE /quality/prevention-actions/<id>/
    """
    permission_classes = [IsAuthenticated]

    def _get_object(self, pk):
        try:
            return PreventionAction.objects.get(pk=pk)
        except PreventionAction.DoesNotExist:
            return None

    def put(self, request, pk):
        obj = self._get_object(pk)
        if not obj:
            return Response({'detail': 'Not found.'}, status=status.HTTP_404_NOT_FOUND)
        serializer = PreventionActionSerializer(obj, data=request.data, partial=True)
        if not serializer.is_valid():
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
        serializer.save()
        return Response(serializer.data)

    def delete(self, request, pk):
        obj = self._get_object(pk)
        if not obj:
            return Response({'detail': 'Not found.'}, status=status.HTTP_404_NOT_FOUND)
        obj.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)


# ═════════════════════════════════════════════════════════════════════════
# ATTACHMENTS
# ═════════════════════════════════════════════════════════════════════════

class ProblemAttachmentUploadView(APIView):
    """POST /quality/attachments/upload/"""
    permission_classes = [IsAuthenticated]

    def post(self, request):
        problem_id = request.data.get('problem_id')
        step = request.data.get('step', 'general')
        file = request.FILES.get('file')

        if not problem_id or not file:
            return Response(
                {'detail': 'problem_id and file are required'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        from apps.quality.models import Problem, ProblemAttachment

        try:
            problem = Problem.objects.get(pk=problem_id)
        except Problem.DoesNotExist:
            return Response({'detail': 'Problem not found'}, status=status.HTTP_404_NOT_FOUND)

        attachment = ProblemAttachment.objects.create(
            problem=problem,
            step=step,
            file=file,
            filename=file.name,
            file_size=file.size,
            uploaded_by=request.user,
        )

        from apps.quality.serializers.problem_serializer import ProblemAttachmentSerializer
        return Response(
            ProblemAttachmentSerializer(attachment).data,
            status=status.HTTP_201_CREATED,
        )


class ProblemAttachmentListView(APIView):
    """GET /quality/attachments/?problem_id=<id>[&step=<step>]"""
    permission_classes = [IsAuthenticated]

    def get(self, request):
        problem_id = request.query_params.get('problem_id')
        if not problem_id:
            return Response({'detail': 'problem_id is required'}, status=status.HTTP_400_BAD_REQUEST)

        from apps.quality.models import ProblemAttachment
        from apps.quality.serializers.problem_serializer import ProblemAttachmentSerializer

        qs = ProblemAttachment.objects.filter(problem_id=problem_id).select_related('uploaded_by')
        step = request.query_params.get('step')
        if step:
            qs = qs.filter(step=step)

        return Response(ProblemAttachmentSerializer(qs.order_by('-uploaded_at'), many=True).data)


class ProblemAttachmentDeleteView(APIView):
    """DELETE /quality/attachments/<id>/"""
    permission_classes = [IsAuthenticated]

    def delete(self, request, pk):
        from apps.quality.models import ProblemAttachment

        try:
            attachment = ProblemAttachment.objects.get(pk=pk)
        except ProblemAttachment.DoesNotExist:
            return Response({'detail': 'Attachment not found'}, status=status.HTTP_404_NOT_FOUND)

        if attachment.file:
            attachment.file.delete(save=False)

        attachment.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)


# ═════════════════════════════════════════════════════════════════════════
# NOTES
# ═════════════════════════════════════════════════════════════════════════

class ProblemNoteListCreateView(APIView):
    """GET /quality/notes/?problem_id=<id>[&step=<step>]  POST /quality/notes/"""
    permission_classes = [IsAuthenticated]

    def get(self, request):
        problem_id = request.query_params.get('problem_id')
        if not problem_id:
            return Response({'detail': 'problem_id is required'}, status=status.HTTP_400_BAD_REQUEST)

        from apps.quality.models import ProblemNote
        from apps.quality.serializers.problem_serializer import ProblemNoteSerializer

        qs = ProblemNote.objects.filter(problem_id=problem_id).select_related('created_by')
        step = request.query_params.get('step')
        if step:
            qs = qs.filter(step=step)

        return Response(ProblemNoteSerializer(qs, many=True).data)

    def post(self, request):
        from apps.quality.models import Problem, ProblemNote
        from apps.quality.serializers.problem_serializer import ProblemNoteSerializer

        problem_id = request.data.get('problem')
        step = request.data.get('step', 'general')
        text = request.data.get('text', '').strip()

        if not problem_id or not text:
            return Response({'detail': 'problem and text are required'}, status=status.HTTP_400_BAD_REQUEST)

        try:
            problem = Problem.objects.get(pk=problem_id)
        except Problem.DoesNotExist:
            return Response({'detail': 'Problem not found'}, status=status.HTTP_404_NOT_FOUND)

        note = ProblemNote.objects.create(
            problem=problem,
            step=step,
            text=text,
            created_by=request.user,
        )
        return Response(ProblemNoteSerializer(note).data, status=status.HTTP_201_CREATED)


class ProblemNoteDetailView(APIView):
    """PUT /quality/notes/<id>/  DELETE /quality/notes/<id>/"""
    permission_classes = [IsAuthenticated]

    def _get_note(self, pk):
        from apps.quality.models import ProblemNote
        try:
            return ProblemNote.objects.get(pk=pk)
        except ProblemNote.DoesNotExist:
            return None

    def put(self, request, pk):
        from apps.quality.serializers.problem_serializer import ProblemNoteSerializer
        note = self._get_note(pk)
        if not note:
            return Response({'detail': 'Note not found'}, status=status.HTTP_404_NOT_FOUND)

        text = request.data.get('text', '').strip()
        if not text:
            return Response({'detail': 'text is required'}, status=status.HTTP_400_BAD_REQUEST)

        note.text = text
        note.save()
        return Response(ProblemNoteSerializer(note).data)

    def delete(self, request, pk):
        note = self._get_note(pk)
        if not note:
            return Response({'detail': 'Note not found'}, status=status.HTTP_404_NOT_FOUND)
        note.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)