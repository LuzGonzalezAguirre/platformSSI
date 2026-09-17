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
from apps.identity.models import User


class ProblemRepository:
    @staticmethod
    def get_all_problems(filters: dict = None) -> list[Problem]:
        queryset = Problem.objects.select_related(
            'champion', 'severity_level', 'defect_type', 'created_by', 'approved_by',
            'manufacturing_approver', 'production_approver', 'maintenance_approver',
        ).prefetch_related(
            'team_members', 'five_why_analyses__root_causes', 'containment_actions',
            'corrective_actions', 'verification_actions', 'prevention_actions', 'attachments',
        )
        if not filters:
            return queryset.all()
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
        return queryset.all()

    @staticmethod
    def get_problem_by_id(problem_id: int) -> Optional[Problem]:
        try:
            return Problem.objects.select_related(
                'champion', 'severity_level', 'defect_type', 'created_by', 'approved_by',
                'manufacturing_approver', 'production_approver', 'maintenance_approver',
                'fmea_responsible', 'control_plan_responsible',
            ).prefetch_related(
                'team_members',
                Prefetch('five_why_analyses', queryset=FiveWhyAnalysis.objects.prefetch_related('root_causes')),
                'containment_actions__responsible', 'corrective_actions__responsible',
                'verification_actions__responsible', 'prevention_actions__responsible',
                'attachments__uploaded_by',
            ).get(pk=problem_id)
        except Problem.DoesNotExist:
            return None

    @staticmethod
    def get_problem_by_number(problem_number: str) -> Optional[Problem]:
        try:
            return Problem.objects.get(problem_number=problem_number)
        except Problem.DoesNotExist:
            return None

    @staticmethod
    def create_problem(data: dict, user: User) -> Problem:
        from apps.quality.services.problem_number_service import ProblemNumberService
        from django.db import transaction
        data = dict(data)
        team_member_ids = data.pop('team_member_ids', [])
        with transaction.atomic():
            problem = Problem.objects.create(
                **data,
                created_by=user,
                status='draft',
                problem_number=ProblemNumberService.generate_problem_number(),
            )
        if team_member_ids:
            from apps.identity.models import User as UserModel
            problem.team_members.set(UserModel.objects.filter(id__in=team_member_ids))
        return problem

    @staticmethod
    def update_problem(problem: Problem, data: dict) -> Problem:
        data = dict(data)
        team_members = data.pop('team_members', None)
        team_member_ids = data.pop('team_member_ids', None)
        approval_pairs = (
            ('manufacturing_approver', 'manufacturing_approved_at'),
            ('production_approver', 'production_approved_at'),
            ('maintenance_approver', 'maintenance_approved_at'),
        )
        for approver_field, approved_at_field in approval_pairs:
            if approver_field in data:
                new_approver = data[approver_field]
                current_id = getattr(problem, f'{approver_field}_id')
                new_id = getattr(new_approver, 'id', None)
                if current_id != new_id:
                    setattr(problem, approved_at_field, None)
        for key, value in data.items():
            setattr(problem, key, value)
        problem.save()
        if team_members is not None:
            problem.team_members.set(team_members)
        elif team_member_ids is not None:
            from apps.identity.models import User as UserModel
            problem.team_members.set(UserModel.objects.filter(id__in=team_member_ids))
        return problem

    @staticmethod
    def delete_problem(problem: Problem):
        if problem.status != 'draft':
            raise ValueError("Solo se pueden eliminar problems en Draft")
        problem.delete()

    @staticmethod
    def get_severity_levels() -> list[SeverityLevel]:
        return list(SeverityLevel.objects.all().order_by('level'))

    @staticmethod
    def get_defect_types(active_only: bool = True) -> list[DefectType]:
        queryset = DefectType.objects.all()
        if active_only:
            queryset = queryset.filter(is_active=True)
        return list(queryset.order_by('code'))

    @staticmethod
    def get_holidays(year: int = None) -> list[Holiday]:
        queryset = Holiday.objects.all()
        if year:
            queryset = queryset.filter(date__year=year)
        return list(queryset.order_by('date'))

    @staticmethod
    def get_next_sequential_number() -> int:
        from django.db import transaction
        with transaction.atomic():
            last_problem = Problem.objects.filter(problem_number__isnull=False).select_for_update().order_by('-problem_number').first()
            if not last_problem or not last_problem.problem_number:
                return 1
            try:
                parts = last_problem.problem_number.split('-')
                if len(parts) == 4:
                    return int(parts[3]) + 1
            except (ValueError, IndexError):
                pass
            return 1

    @staticmethod
    def get_users_by_role(role_slug: str):
        return list(
            User.objects.filter(user_roles__role__slug=role_slug, is_active=True)
            .distinct().order_by('first_name', 'last_name')
        )

    @staticmethod
    def get_quality_managers() -> list[User]:
        return list(User.objects.filter(job_title__icontains='Quality Manager', is_active=True))

    @staticmethod
    def approve_problem(problem: Problem, manager: User, comments: str = ""):
        from django.utils import timezone
        problem.approved_by = manager
        problem.approved_at = timezone.now()
        problem.approval_comments = comments
        all_four = bool(
            problem.manufacturing_approved_at
            and problem.production_approved_at
            and problem.maintenance_approved_at
        )
        problem.status = 'approved' if all_four else 'pending_approval'
        problem.save()
        return problem

    @staticmethod
    def reject_problem(problem: Problem, manager: User, comments: str):
        from django.utils import timezone
        problem.status = 'rejected'
        problem.approved_by = manager
        problem.approved_at = timezone.now()
        problem.approval_comments = comments
        problem.save()
        return problem

    @staticmethod
    def close_problem(problem: Problem) -> tuple[bool, str]:
        from django.utils import timezone
        can_close, error = problem.can_close()
        if not can_close:
            return False, error
        problem.status = 'closed'
        problem.closed_at = timezone.now()
        problem.actual_close_date = timezone.now().date()
        problem.save()
        return True, ""
