"""
Problem Repository - Data access layer
"""
import uuid
from typing import Dict, Optional
from django.db.models import Q, Count, QuerySet
from django.utils import timezone

from ..models import Problem, Stage

class ProblemRepository:
    """
    Repository pattern for Problem data access.
    All database queries should go through this layer.
    """
    
    def create(self, data: Dict) -> Problem:
        """Create new problem."""
        return Problem.objects.create(**data)
    
    def get_by_id(self, problem_id: uuid.UUID) -> Problem:
        """Get problem by UUID with prefetched relations."""
        return Problem.objects.prefetch_related(
            'stages',
            'created_by',
            'assigned_champion',
            'assigned_quality'
        ).get(id=problem_id)
    
    def get_by_number(self, problem_number: str) -> Problem:
        """Get problem by official number."""
        return Problem.objects.prefetch_related('stages').get(
            problem_number=problem_number
        )
    
    def update(self, problem_id: uuid.UUID, data: Dict) -> Problem:
        """Update problem fields."""
        Problem.objects.filter(id=problem_id).update(**data)
        return self.get_by_id(problem_id)
    
    def delete(self, problem_id: uuid.UUID) -> None:
        """Delete problem (only drafts allowed)."""
        problem = self.get_by_id(problem_id)
        if problem.status != Problem.Status.DRAFT:
            raise ValueError("Can only delete DRAFT problems")
        problem.delete()
    
    def list_for_user(
        self,
        user,
        filters: Optional[Dict] = None
    ) -> QuerySet[Problem]:
        """
        List problems visible to user based on role.
        Applies role-based filtering.
        """
        # Base queryset with annotations
        qs = Problem.objects.annotate(
            overdue_stages_count=Count(
                'stages',
                filter=Q(
                    stages__completed_at__isnull=True,
                    stages__due_date__lt=timezone.now()
                )
            )
        ).select_related('created_by')
        
        # Role-based filtering
        user_role = self._get_user_role(user)
        
        if user_role in ['manager', 'quality']:
            # See all problems
            pass
        elif user_role == 'champion':
            # See own created problems
            qs = qs.filter(
                Q(created_by=user) | Q(assigned_champion=user)
            )
        elif user_role == 'supplier':
            # See only assigned problems
            qs = qs.filter(assigned_supplier=user)
        else:
            # Default: no access
            qs = qs.none()
        
        # Apply filters
        if filters:
            if 'status' in filters and filters['status']:
                qs = qs.filter(status=filters['status'])
            
            if 'severity' in filters and filters['severity']:
                qs = qs.filter(severity=filters['severity'])
            
            if 'search' in filters and filters['search']:
                search_term = filters['search']
                qs = qs.filter(
                    Q(problem_number__icontains=search_term) |
                    Q(customer_name__icontains=search_term) |
                    Q(description__icontains=search_term) |
                    Q(part_number__icontains=search_term)
                )
            
            if 'created_by' in filters and filters['created_by']:
                qs = qs.filter(created_by_id=filters['created_by'])
            
            if 'date_from' in filters and filters['date_from']:
                qs = qs.filter(created_at__gte=filters['date_from'])
            
            if 'date_to' in filters and filters['date_to']:
                qs = qs.filter(created_at__lte=filters['date_to'])
        
        return qs.order_by('-created_at')
    
    def get_overdue_problems(self) -> QuerySet[Problem]:
        """Get all problems with at least one overdue stage."""
        return Problem.objects.filter(
            stages__completed_at__isnull=True,
            stages__due_date__lt=timezone.now()
        ).distinct()
    
    def get_pending_approval(self) -> QuerySet[Problem]:
        """Get problems pending manager approval."""
        return Problem.objects.filter(
            status=Problem.Status.PENDING_APPROVAL
        ).select_related('created_by')
    
    def _get_user_role(self, user) -> str:
        """Extract user role from job_title."""
        if hasattr(user, 'job_title') and user.job_title:
            return user.job_title.lower()
        return 'viewer'


class StageRepository:
    """Repository for Stage data access."""
    
    def get_by_id(self, stage_id: uuid.UUID) -> Stage:
        """Get stage by UUID."""
        return Stage.objects.select_related('problem').get(id=stage_id)
    
    def update_data(self, stage_id: uuid.UUID, data: Dict) -> Stage:
        """Update stage data field (JSONB)."""
        stage = self.get_by_id(stage_id)
        stage.data.update(data)
        stage.save()
        return stage
    
    def complete_stage(self, stage_id: uuid.UUID, user) -> Stage:
        """Mark stage as completed."""
        stage = self.get_by_id(stage_id)
        stage.complete(user)
        return stage
    
    def get_overdue_stages(self) -> QuerySet[Stage]:
        """Get all overdue stages."""
        return Stage.objects.filter(
            completed_at__isnull=True,
            due_date__lt=timezone.now(),
            override_approved=False
        ).select_related('problem')