# apps/quality/services/problem_service.py
from typing import Optional
from django.db import transaction
from django.core.exceptions import PermissionDenied, ValidationError
from apps.quality.models import Problem, ProblemAudit
from apps.quality.repositories.problem_repository import ProblemRepository
from apps.quality.services.sla_service import SLAService
from apps.identity.models import User


class ProblemService:
    """
    Business logic layer para Problem Control.
    Orquesta repositories, validaciones y workflows.
    """

    @staticmethod
    def get_all_problems(filters: dict = None, user: User = None) -> list[Problem]:
        """
        Obtener lista de problems con filtros.
        RBAC: Solo usuarios con System Role "quality_engineer" o "admin".
        """
        if not ProblemService._has_quality_access(user):
            raise PermissionDenied("User does not have Quality access")

        problems = ProblemRepository.get_all_problems(filters)

        # Si filter overdue=True, filtrar en Python
        if filters and filters.get('overdue'):
            problems = [
                p for p in problems
                if p.is_d3_overdue() or p.is_d4_overdue() or
                   p.is_d5_overdue() or p.is_d6_overdue() or
                   p.is_d7_overdue() or p.is_d8_overdue()
            ]

        return problems

    @staticmethod
    def get_problem_by_id(problem_id: int, user: User) -> Optional[Problem]:
        """Obtener problem por ID con validación de permisos"""
        if not ProblemService._has_quality_access(user):
            raise PermissionDenied("User does not have Quality access")

        problem = ProblemRepository.get_problem_by_id(problem_id)
        if not problem:
            raise ValidationError(f"Problem {problem_id} not found")

        return problem

    @staticmethod
    @transaction.atomic
    def create_problem(data: dict, user: User) -> Problem:
        """
        Crear nuevo problem en estado Draft.
        
        Validaciones:
        - User debe tener System Role "quality_engineer" o "admin"
        - Champion debe tener System Role "quality_engineer"
        - Campos obligatorios: brief_description, full_description, 
          problem_type, severity_level, champion, date_of_occurrence
        """
        if not ProblemService._has_quality_access(user):
            raise PermissionDenied("User does not have Quality access")

        # Validar champion tiene rol Quality
        champion = data.get('champion')
        if not ProblemService._has_quality_role(champion):
            raise ValidationError("Champion must have Quality Engineer system role")

        # Validar campos obligatorios
        required_fields = [
            'brief_description',
            'full_description',
            'problem_type',
            'severity_level',
            'champion',
            'date_of_occurrence',
        ]
        for field in required_fields:
            if field not in data or not data[field]:
                raise ValidationError(f"Field '{field}' is required")

        # Calcular SLA snapshots (congelar valores actuales)
        data['sla_d3_hours'] = 48
        data['sla_d4_days'] = 10
        data['sla_d5_days'] = 20
        data['sla_d6_days'] = 20
        data['sla_d7_days'] = 30
        data['sla_d8_days'] = 30

        # Crear problem
        problem = ProblemRepository.create_problem(data, user)

        # Audit log
        ProblemService._create_audit(
            problem=problem,
            user=user,
            action='created',
            changes={'status': 'draft'}
        )

        return problem

    @staticmethod
    @transaction.atomic
    def update_problem(problem_id: int, data: dict, user: User) -> Problem:
        """
        Actualizar problem existente.
        
        Validaciones:
        - Solo editable si status = draft o approved
        - Si status = closed o rejected, no editable
        - Si globally overdue (>30 días), requiere override approval
        """
        if not ProblemService._has_quality_access(user):
            raise PermissionDenied("User does not have Quality access")

        problem = ProblemRepository.get_problem_by_id(problem_id)
        if not problem:
            raise ValidationError(f"Problem {problem_id} not found")

        # Validar estado editable
        if problem.status in ['closed', 'rejected']:
            raise ValidationError(f"Cannot edit problem in {problem.status} status")

        # Validar override si globally overdue
        if problem.is_globally_overdue() and not problem.override_approved_by:
            raise ValidationError(
                "Problem is globally overdue (>30 days). "
                "Manager override approval required to continue editing."
            )

        # Capturar cambios para audit
        old_values = {
            'status': problem.status,
            'brief_description': problem.brief_description,
        }

        # Actualizar
        problem = ProblemRepository.update_problem(problem, data)

        # Audit log
        ProblemService._create_audit(
            problem=problem,
            user=user,
            action='updated',
            changes={
                'old': old_values,
                'new': {k: getattr(problem, k) for k in old_values.keys()}
            }
        )

        return problem

    @staticmethod
    @transaction.atomic
    def submit_for_approval(problem_id: int, user: User) -> Problem:
        """
        Enviar problem a aprobación (Draft → Pending Approval).
        
        Validaciones:
        - Problem debe estar en Draft
        - Campos obligatorios Step 1 completos
        """
        problem = ProblemRepository.get_problem_by_id(problem_id)
        if not problem:
            raise ValidationError(f"Problem {problem_id} not found")

        if problem.status != 'draft':
            raise ValidationError(
                f"Cannot submit problem in {problem.status} status"
            )

        # Validar campos mínimos Step 1
        if not all([
            problem.brief_description,
            problem.full_description,
            problem.problem_type,
            problem.severity_level,
            problem.champion,
            problem.date_of_occurrence,
        ]):
            raise ValidationError("Incomplete Step 1 fields")

        # Cambiar estado
        problem.status = 'pending_approval'
        problem.save()

        # Audit log
        ProblemService._create_audit(
            problem=problem,
            user=user,
            action='submitted_for_approval',
            changes={'status': 'pending_approval'}
        )

        return problem

    @staticmethod
    @transaction.atomic
    def approve_problem(problem_id: int, manager: User, comments: str = "") -> Problem:
        """
        Aprobar problem (Pending Approval → Approved).
        Genera problem_number.
        
        Validaciones:
        - User debe tener Job Title "Quality Manager"
        - Problem debe estar en Pending Approval
        """
        if not ProblemService._is_quality_manager(manager):
            raise PermissionDenied("Only Quality Managers can approve problems")

        problem = ProblemRepository.get_problem_by_id(problem_id)
        if not problem:
            raise ValidationError(f"Problem {problem_id} not found")

        if problem.status != 'pending_approval':
            raise ValidationError(
                f"Cannot approve problem in {problem.status} status"
            )

        # Aprobar y generar problem_number
        problem = ProblemRepository.approve_problem(problem, manager, comments)

        # Audit log
        ProblemService._create_audit(
            problem=problem,
            user=manager,
            action='approved',
            changes={
                'status': 'approved',
                'problem_number': problem.problem_number,
                'comments': comments
            }
        )

        return problem

    @staticmethod
    @transaction.atomic
    def reject_problem(problem_id: int, manager: User, comments: str) -> Problem:
        """
        Rechazar problem (Pending Approval → Rejected).
        
        Validaciones:
        - User debe tener Job Title "Quality Manager"
        - Comments son obligatorios
        """
        if not ProblemService._is_quality_manager(manager):
            raise PermissionDenied("Only Quality Managers can reject problems")

        if not comments:
            raise ValidationError("Rejection comments are required")

        problem = ProblemRepository.get_problem_by_id(problem_id)
        if not problem:
            raise ValidationError(f"Problem {problem_id} not found")

        if problem.status != 'pending_approval':
            raise ValidationError(
                f"Cannot reject problem in {problem.status} status"
            )

        # Rechazar
        problem = ProblemRepository.reject_problem(problem, manager, comments)

        # Audit log
        ProblemService._create_audit(
            problem=problem,
            user=manager,
            action='rejected',
            changes={
                'status': 'rejected',
                'comments': comments
            }
        )

        return problem

    @staticmethod
    @transaction.atomic
    def close_problem(problem_id: int, user: User) -> Problem:
        """
        Cerrar problem (Approved → Closed).
        
        Validaciones:
        - Todos los steps completados
        - FMEA/Control Plan actualizados si required
        - Five Why completo (min 3 por categoría)
        - Root Causes identificadas
        - Corrective Actions por Root Cause
        """
        if not ProblemService._has_quality_access(user):
            raise PermissionDenied("User does not have Quality access")

        problem = ProblemRepository.get_problem_by_id(problem_id)
        if not problem:
            raise ValidationError(f"Problem {problem_id} not found")

        if problem.status != 'approved':
            raise ValidationError(
                f"Cannot close problem in {problem.status} status"
            )

        # Validar con SLAService
        can_close, validation_error = ProblemRepository.close_problem(problem)
        if not can_close:
            raise ValidationError(validation_error)

        # Audit log
        ProblemService._create_audit(
            problem=problem,
            user=user,
            action='closed',
            changes={'status': 'closed'}
        )

        return problem

    @staticmethod
    @transaction.atomic
    def request_override(problem_id: int, user: User, reason: str) -> Problem:
        """
        Solicitar override para continuar editando problem globally overdue.
        """
        if not ProblemService._has_quality_access(user):
            raise PermissionDenied("User does not have Quality access")

        if not reason:
            raise ValidationError("Override reason is required")

        problem = ProblemRepository.get_problem_by_id(problem_id)
        if not problem:
            raise ValidationError(f"Problem {problem_id} not found")

        if not problem.is_globally_overdue():
            raise ValidationError("Problem is not globally overdue")

        problem.override_requested = True
        problem.override_reason = reason
        problem.save()

        # Audit log
        ProblemService._create_audit(
            problem=problem,
            user=user,
            action='override_requested',
            changes={'reason': reason}
        )

        return problem

    @staticmethod
    @transaction.atomic
    def approve_override(problem_id: int, manager: User) -> Problem:
        """
        Aprobar override request.
        Solo Quality Managers pueden aprobar.
        """
        if not ProblemService._is_quality_manager(manager):
            raise PermissionDenied("Only Quality Managers can approve overrides")

        problem = ProblemRepository.get_problem_by_id(problem_id)
        if not problem:
            raise ValidationError(f"Problem {problem_id} not found")

        if not problem.override_requested:
            raise ValidationError("No override request pending")

        from django.utils import timezone

        problem.override_approved_by = manager
        problem.override_approved_at = timezone.now()
        problem.save()

        # Audit log
        ProblemService._create_audit(
            problem=problem,
            user=manager,
            action='override_approved',
            changes={}
        )

        return problem

    @staticmethod
    @transaction.atomic
    def delete_problem(problem_id: int, user: User):
        """
        Eliminar problem (solo Draft).
        """
        if not ProblemService._has_quality_access(user):
            raise PermissionDenied("User does not have Quality access")

        try:
            problem = Problem.objects.get(pk=problem_id)
        except Problem.DoesNotExist:
            raise ValidationError(f"Problem {problem_id} not found")

        if problem.status != 'draft':
            raise ValidationError("Only draft problems can be deleted")

        # Audit log BEFORE deleting (so FK still valid)
        ProblemService._create_audit(
            problem=problem,
            user=user,
            action='deleted',
            changes={'id': problem_id, 'problem_number': problem.problem_number}
        )

        # CASCADE handles related objects
        problem.delete()

    # ═════════════════════════════════════════════════════════════════════
    # HELPER METHODS
    # ═════════════════════════════════════════════════════════════════════

    @staticmethod
    def _has_quality_access(user: User) -> bool:
        """
        Check if user has Quality Engineer or Administrator role.
        
        ⚠️ CAMBIO CRÍTICO: Ahora busca 'quality_engineer' en lugar de 'quality'
        """
        if not user or not user.is_authenticated:
            return False
        
        roles = user.user_roles.values_list('role__slug', flat=True)
        return 'quality_engineer' in roles or 'admin' in roles

    @staticmethod
    def _has_quality_role(user: User) -> bool:
        """Check if user has quality_engineer system role."""
        if not user or not user.is_authenticated:
            return False
        roles = user.user_roles.values_list('role__slug', flat=True)
        return 'quality_engineer' in roles

    @staticmethod
    def _is_quality_manager(user: User) -> bool:
        """Check if user has Quality Manager job title"""
        if not user or not user.is_authenticated:
            return False
        
        return user.job_title and 'Quality Manager' in user.job_title

    @staticmethod
    def _create_audit(problem: Problem, user: User, action: str, changes: dict):
        """Create audit log entry"""
        ProblemAudit.objects.create(
            problem=problem,
            user=user,
            action=action,
            changes=changes,
        )

    # ═════════════════════════════════════════════════════════════════════
    # CATALOG METHODS
    # ═════════════════════════════════════════════════════════════════════

    @staticmethod
    def get_severity_levels():
        """Get all severity levels"""
        return ProblemRepository.get_severity_levels()

    @staticmethod
    def get_defect_types():
        """Get active defect types"""
        return ProblemRepository.get_defect_types(active_only=True)

    @staticmethod
    def get_quality_users():
        """
        Get users with quality_engineer role for Champion/Team selection.
        
        ⚠️ CAMBIO CRÍTICO: Ahora busca 'quality_engineer' en lugar de 'quality'
        """
        return ProblemRepository.get_users_by_role('quality_engineer')

    @staticmethod
    def get_quality_managers():
        """Get Quality Managers (for approval workflow)"""
        return ProblemRepository.get_quality_managers()