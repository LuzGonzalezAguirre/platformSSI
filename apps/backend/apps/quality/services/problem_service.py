"""
Problem Control Services - Business logic layer
"""
import uuid
from datetime import timedelta
from django.db import transaction
from django.utils import timezone
from typing import Dict, Optional

from ..models import Problem, Stage, SLASettings, AuditLog
from ..repositories.problem_repository import ProblemRepository



class ProblemService:
    """
    Service layer for Problem Control business logic.
    All workflow operations go through this service.
    """
    
    def __init__(self):
        self.repository = ProblemRepository()
    
    @transaction.atomic
    def create_draft(
        self,
        data: Dict,
        user,
        request_meta: Optional[Dict] = None
    ) -> Problem:
        """Create new problem in DRAFT status."""
        sla_settings = SLASettings.get_current()
        
        problem_data = {
            'created_by': user,
            'status': Problem.Status.DRAFT,
            'sla_d3_hours': sla_settings.d3_hours,
            'sla_d4_days': sla_settings.d4_days,
            'sla_d5_days': sla_settings.d5_days,
            'sla_d6_days': sla_settings.d6_days,
            'sla_d7_days': sla_settings.d7_days,
            **data
        }
        
        problem = self.repository.create(problem_data)
        
        AuditLog.log_change(
            entity=problem,
            action=AuditLog.Action.CREATED,
            user=user,
            changes={},
            ip_address=request_meta.get('ip_address') if request_meta else None,
            user_agent=request_meta.get('user_agent') if request_meta else None
        )
        
        return problem
    
    @transaction.atomic
    def update_draft(
        self,
        problem_id: uuid.UUID,
        data: Dict,
        user,
        request_meta: Optional[Dict] = None
    ) -> Problem:
        """Update problem in DRAFT status."""
        problem = self.repository.get_by_id(problem_id)
        
        if problem.status != Problem.Status.DRAFT:
            raise ValueError("Can only update problems in DRAFT status")
        
        if problem.created_by != user:
            raise ValueError("Can only update own problems")
        
        old_values = {
            field: getattr(problem, field)
            for field in data.keys()
        }
        
        problem = self.repository.update(problem_id, data)
        
        changes = {
            field: {'old': old_values[field], 'new': data[field]}
            for field in data.keys()
            if old_values[field] != data[field]
        }
        
        if changes:
            AuditLog.log_change(
                entity=problem,
                action=AuditLog.Action.UPDATED,
                user=user,
                changes=changes,
                ip_address=request_meta.get('ip_address') if request_meta else None,
                user_agent=request_meta.get('user_agent') if request_meta else None
            )
        
        return problem
    
    @transaction.atomic
    def submit_for_approval(
        self,
        problem_id: uuid.UUID,
        user,
        request_meta: Optional[Dict] = None
    ) -> Problem:
        """Submit draft problem for manager approval."""
        problem = self.repository.get_by_id(problem_id)
        
        if problem.status != Problem.Status.DRAFT:
            raise ValueError("Only DRAFT problems can be submitted")
        
        problem.status = Problem.Status.PENDING_APPROVAL
        problem.save()
        
        AuditLog.log_change(
            entity=problem,
            action=AuditLog.Action.UPDATED,
            user=user,
            changes={'status': {'old': 'draft', 'new': 'pending_approval'}},
            ip_address=request_meta.get('ip_address') if request_meta else None,
            user_agent=request_meta.get('user_agent') if request_meta else None
        )
        
        return problem
    
    @transaction.atomic
    def approve_problem(
        self,
        problem_id: uuid.UUID,
        approver,
        request_meta: Optional[Dict] = None
    ) -> Problem:
        """
        Approve problem and assign official number.
        Generates unique problem number and initializes all 8D stages.
        """
        problem = Problem.objects.select_for_update().get(id=problem_id)
        
        if problem.status != Problem.Status.PENDING_APPROVAL:
            raise ValueError("Problem must be PENDING_APPROVAL status")
        
        # Generate official problem number (thread-safe)
        problem_number = self._generate_problem_number()
        
        problem.problem_number = problem_number
        problem.status = Problem.Status.APPROVED
        problem.approved_at = timezone.now()
        problem.save()
        
        # Initialize 8D stages
        self._initialize_stages(problem)
        
        AuditLog.log_change(
            entity=problem,
            action=AuditLog.Action.APPROVED,
            user=approver,
            changes={
                'status': {'old': 'pending_approval', 'new': 'approved'},
                'problem_number': {'old': None, 'new': problem_number},
                'approved_by': approver.get_full_name()
            },
            ip_address=request_meta.get('ip_address') if request_meta else None,
            user_agent=request_meta.get('user_agent') if request_meta else None
        )
        
        return problem
    
    @transaction.atomic
    def reject_problem(
        self,
        problem_id: uuid.UUID,
        reason: str,
        rejector,
        request_meta: Optional[Dict] = None
    ) -> Problem:
        """Reject problem and return to DRAFT."""
        problem = self.repository.get_by_id(problem_id)
        
        if problem.status != Problem.Status.PENDING_APPROVAL:
            raise ValueError("Only PENDING_APPROVAL problems can be rejected")
        
        problem.status = Problem.Status.REJECTED
        problem.save()
        
        AuditLog.log_change(
            entity=problem,
            action=AuditLog.Action.REJECTED,
            user=rejector,
            changes={
                'status': {'old': 'pending_approval', 'new': 'rejected'},
                'reason': reason,
                'rejected_by': rejector.get_full_name()
            },
            ip_address=request_meta.get('ip_address') if request_meta else None,
            user_agent=request_meta.get('user_agent') if request_meta else None
        )
        
        return problem
    
    @transaction.atomic
    def close_problem(
        self,
        problem_id: uuid.UUID,
        user,
        request_meta: Optional[Dict] = None
    ) -> Problem:
        """Close problem (validates all stages completed)."""
        problem = self.repository.get_by_id(problem_id)
        
        if problem.status != Problem.Status.APPROVED:
            raise ValueError("Only APPROVED problems can be closed")
        
        incomplete_stages = problem.stages.exclude(
            status=Stage.Status.COMPLETED
        ).values_list('stage_code', flat=True)
        
        if incomplete_stages:
            stages_str = ', '.join(incomplete_stages)
            raise ValueError(f"Cannot close - incomplete stages: {stages_str}")
        
        problem.status = Problem.Status.CLOSED
        problem.closed_at = timezone.now()
        problem.save()
        
        AuditLog.log_change(
            entity=problem,
            action=AuditLog.Action.CLOSED,
            user=user,
            changes={
                'status': {'old': 'approved', 'new': 'closed'},
                'closed_by': user.get_full_name()
            },
            ip_address=request_meta.get('ip_address') if request_meta else None,
            user_agent=request_meta.get('user_agent') if request_meta else None
        )
        
        return problem
    
    def _generate_problem_number(self) -> str:
        """Generate next problem number using PostgreSQL function."""
        from django.db import connection
        
        with connection.cursor() as cursor:
            cursor.execute("SELECT get_next_problem_number()")
            problem_number = cursor.fetchone()[0]
        
        return problem_number
    
    def _initialize_stages(self, problem: Problem) -> None:
        """Initialize all 8D stages with calculated due dates."""
        base_date = problem.created_at
        
        stages_config = [
            ('D1', 'Define Problem', None),
            ('D2', 'Define Team', None),
            ('D3', 'Initial Response', base_date + timedelta(hours=problem.sla_d3_hours)),
            ('D4', 'Containment', base_date + timedelta(days=problem.sla_d4_days)),
            ('D5', 'Five Why', base_date + timedelta(days=problem.sla_d5_days)),
            ('D6', 'Root Cause', base_date + timedelta(days=problem.sla_d6_days)),
            ('D7', 'Permanent Corrective Action', base_date + timedelta(days=problem.sla_d7_days)),
            ('D8', 'Verification Control', None),
        ]
        
        stages = []
        for code, name, due_date in stages_config:
            stage = Stage(
                problem=problem,
                stage_code=code,
                stage_name=name,
                due_date=due_date,
                status=Stage.Status.PENDING,
                data={}
            )
            stages.append(stage)
        
        Stage.objects.bulk_create(stages)