# apps/quality/repositories/problem_repository.py
from typing import Optional
from django.db.models import Q, Prefetch
from apps.quality.models import (
    Problem,
    SeverityLevel,
    DefectType,
    Holiday,
    FiveWhyAnalysis,
    RootCause,
)
from apps.identity.models import User  # ← Ya está importado aquí


class ProblemRepository:
    """
    Data access layer para Problem Control.
    Todas las queries a la BD pasan por aquí.
    """

    @staticmethod
    def get_all_problems(filters: dict = None) -> list[Problem]:
        """
        Obtener todos los problems con filtros opcionales.
        Optimizado con select_related y prefetch_related.
        """
        queryset = Problem.objects.select_related(
            'champion',
            'severity_level',
            'defect_type',
            'created_by',
            'approved_by',
        ).prefetch_related(
            'team_members',
            'five_why_analyses__root_causes',
            'containment_actions',
            'corrective_actions',
            'verification_actions',
            'prevention_actions',
            'attachments',
        )

        if not filters:
            return queryset.all()

        # Aplicar filtros
        if filters.get('status'):
            queryset = queryset.filter(status=filters['status'])

        if filters.get('customer_no'):
            queryset = queryset.filter(customer_no__icontains=filters['customer_no'])

        if filters.get('category'):
            queryset = queryset.filter(category=filters['category'])

        if filters.get('severity_level'):
            queryset = queryset.filter(severity_level_id=filters['severity_level'])

        if filters.get('champion_id'):
            queryset = queryset.filter(champion_id=filters['champion_id'])

        if filters.get('start_date'):
            queryset = queryset.filter(created_at__gte=filters['start_date'])

        if filters.get('end_date'):
            queryset = queryset.filter(created_at__lte=filters['end_date'])

        if filters.get('overdue'):
            # Filtrar solo los que están overdue (esto requiere lógica Python)
            # Por ahora devolvemos todos y filtramos en service
            pass

        return queryset.all()

    @staticmethod
    def get_problem_by_id(problem_id: int) -> Optional[Problem]:
        """Obtener problem por ID con todas las relaciones"""
        try:
            return Problem.objects.select_related(
                'champion',
                'severity_level',
                'defect_type',
                'created_by',
                'approved_by',
                'fmea_responsible',
                'control_plan_responsible',
            ).prefetch_related(
                'team_members',
                Prefetch(
                    'five_why_analyses',
                    queryset=FiveWhyAnalysis.objects.prefetch_related('root_causes')
                ),
                'containment_actions__responsible',
                'corrective_actions__responsible',
                'verification_actions__responsible',
                'prevention_actions__responsible',
                'attachments__uploaded_by',
            ).get(pk=problem_id)
        except Problem.DoesNotExist:
            return None

    @staticmethod
    def get_problem_by_number(problem_number: str) -> Optional[Problem]:
        """Obtener problem por problem_number"""
        try:
            return Problem.objects.get(problem_number=problem_number)
        except Problem.DoesNotExist:
            return None

    @staticmethod
    def create_problem(data: dict, user: User) -> Problem:
        """Crear nuevo problem en Draft"""
        return Problem.objects.create(**data, created_by=user, status='draft')

    @staticmethod
    def update_problem(problem: Problem, data: dict) -> Problem:
        """Actualizar problem existente"""
        for key, value in data.items():
            setattr(problem, key, value)
        problem.save()
        return problem

    @staticmethod
    def delete_problem(problem: Problem):
        """Eliminar problem (solo Draft permitido)"""
        if problem.status != 'draft':
            raise ValueError("Solo se pueden eliminar problems en Draft")
        problem.delete()

    @staticmethod
    def get_severity_levels() -> list[SeverityLevel]:
        """Obtener todos los severity levels"""
        return list(SeverityLevel.objects.all().order_by('level'))

    @staticmethod
    def get_defect_types(active_only: bool = True) -> list[DefectType]:
        """Obtener defect types"""
        queryset = DefectType.objects.all()
        if active_only:
            queryset = queryset.filter(is_active=True)
        return list(queryset.order_by('code'))

    @staticmethod
    def get_holidays(year: int = None) -> list[Holiday]:
        """Obtener holidays para cálculo SLA"""
        queryset = Holiday.objects.all()
        if year:
            queryset = queryset.filter(date__year=year)
        return list(queryset.order_by('date'))

    @staticmethod
    def get_next_sequential_number() -> int:
        """
        Obtener el siguiente número secuencial para problem_number.
        Thread-safe usando select_for_update.
        """
        from django.db import transaction
        
        with transaction.atomic():
            # Buscar el último problem number con formato CA-WW-YY-XXXXX
            last_problem = Problem.objects.filter(
                problem_number__isnull=False
            ).select_for_update().order_by('-problem_number').first()

            if not last_problem or not last_problem.problem_number:
                return 1

            # Extraer número secuencial del formato CA-WW-YY-XXXXX
            try:
                parts = last_problem.problem_number.split('-')
                if len(parts) == 4:
                    last_seq = int(parts[3])
                    return last_seq + 1
            except (ValueError, IndexError):
                pass

            return 1

    @staticmethod
    def get_users_by_role(role_slug: str):
        """
        Obtener usuarios que tienen un rol específico.
        """
        # User ya está importado al inicio del archivo
        return list(
            User.objects.filter(
                user_roles__role__slug=role_slug,
                is_active=True
            ).distinct().order_by('first_name', 'last_name')
        )
    @staticmethod
    def get_quality_managers() -> list[User]:
        """
        Obtener usuarios con Job Title = Quality Manager.
        Necesario para approval workflow.
        """
        return list(
            User.objects.filter(
                job_title__icontains='Quality Manager',
                is_active=True
            )
        )

    @staticmethod
    def approve_problem(problem: Problem, manager: User, comments: str = ""):
        """
        Aprobar problem y generar problem_number.
        """
        from django.utils import timezone
        from apps.quality.services.problem_number_service import ProblemNumberService

        problem.status = 'approved'
        problem.approved_by = manager
        problem.approved_at = timezone.now()
        problem.approval_comments = comments
        problem.problem_number = ProblemNumberService.generate_problem_number()
        problem.save()
        return problem

    @staticmethod
    def reject_problem(problem: Problem, manager: User, comments: str):
        """Rechazar problem"""
        from django.utils import timezone
        
        problem.status = 'rejected'
        problem.approved_by = manager
        problem.approved_at = timezone.now()
        problem.approval_comments = comments
        problem.save()
        return problem

    @staticmethod
    def close_problem(problem: Problem) -> tuple[bool, str]:
        """
        Cerrar problem después de validaciones.
        Returns: (success, error_message)
        """
        from django.utils import timezone
        
        can_close, error = problem.can_close()
        if not can_close:
            return False, error

        problem.status = 'closed'
        problem.closed_at = timezone.now()
        problem.actual_close_date = timezone.now().date()
        problem.save()
        return True, ""