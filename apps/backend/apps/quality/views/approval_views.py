from django.utils import timezone
from rest_framework import status
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.quality.models import Problem, ProblemNote
from apps.quality.services.problem_service import ProblemService


APPROVAL_NOTE_PREFIX = "[8D_APPROVAL:{role}] "


def _user_data(user):
    if not user:
        return None
    return {
        "id": user.id,
        "username": user.username,
        "first_name": user.first_name,
        "last_name": user.last_name,
        "email": user.email,
        "job_title": user.job_title,
    }


def _get_department_comment(problem, role):
    prefix = APPROVAL_NOTE_PREFIX.format(role=role)
    note = (
        ProblemNote.objects.filter(problem=problem, step="step8", text__startswith=prefix)
        .order_by("-created_at")
        .first()
    )
    return note.text[len(prefix):] if note else ""


def _save_department_comment(problem, role, comment, user):
    prefix = APPROVAL_NOTE_PREFIX.format(role=role)
    note = (
        ProblemNote.objects.filter(problem=problem, step="step8", text__startswith=prefix)
        .order_by("-created_at")
        .first()
    )
    if note:
        note.text = f"{prefix}{comment}"
        note.created_by = user
        note.save(update_fields=["text", "created_by", "updated_at"])
    else:
        ProblemNote.objects.create(
            problem=problem,
            step="step8",
            text=f"{prefix}{comment}",
            created_by=user,
        )


def _all_approved(problem):
    return bool(
        problem.approved_by_id
        and problem.approved_at
        and problem.manufacturing_approved_at
        and problem.production_approved_at
        and problem.maintenance_approved_at
    )


def _sync_status(problem):
    if problem.status == "closed":
        return
    desired = "approved" if _all_approved(problem) else "pending_approval"
    if problem.status != desired:
        problem.status = desired
        problem.save(update_fields=["status", "updated_at"])


def _payload(problem, request_user):
    roles = [
        {
            "role": "quality",
            "label": "Quality Manager",
            "approver": _user_data(problem.approved_by),
            "approved_at": problem.approved_at,
            "comments": problem.approval_comments or "",
            "can_approve": (
                problem.status == "pending_approval"
                and problem.approved_at is None
                and ProblemService._is_quality_manager(request_user)
            ),
        },
        {
            "role": "manufacturing",
            "label": "Manufacturing",
            "approver": _user_data(problem.manufacturing_approver),
            "approved_at": problem.manufacturing_approved_at,
            "comments": _get_department_comment(problem, "manufacturing"),
            "can_approve": (
                problem.status == "pending_approval"
                and problem.manufacturing_approved_at is None
                and problem.manufacturing_approver_id == request_user.id
            ),
        },
        {
            "role": "production",
            "label": "Production",
            "approver": _user_data(problem.production_approver),
            "approved_at": problem.production_approved_at,
            "comments": _get_department_comment(problem, "production"),
            "can_approve": (
                problem.status == "pending_approval"
                and problem.production_approved_at is None
                and problem.production_approver_id == request_user.id
            ),
        },
        {
            "role": "maintenance",
            "label": "Maintenance",
            "approver": _user_data(problem.maintenance_approver),
            "approved_at": problem.maintenance_approved_at,
            "comments": _get_department_comment(problem, "maintenance"),
            "can_approve": (
                problem.status == "pending_approval"
                and problem.maintenance_approved_at is None
                and problem.maintenance_approver_id == request_user.id
            ),
        },
    ]
    approved_count = sum(1 for item in roles if item["approved_at"])
    return {
        "problem_id": problem.id,
        "problem_number": problem.problem_number,
        "brief_description": problem.brief_description,
        "status": problem.status,
        "status_display": problem.get_status_display(),
        "approved_count": approved_count,
        "required_count": 4,
        "ready_to_close": problem.status == "approved" and approved_count == 4,
        "approvals": roles,
    }


class ProblemFinalApprovalView(APIView):
    """Unified final approval stage for Quality + Manufacturing + Production + Maintenance."""

    permission_classes = [IsAuthenticated]

    def _get_problem(self, pk):
        return Problem.objects.select_related(
            "approved_by",
            "manufacturing_approver",
            "production_approver",
            "maintenance_approver",
        ).filter(pk=pk).first()

    def get(self, request, pk: int):
        problem = self._get_problem(pk)
        if not problem:
            return Response({"detail": "Problem not found"}, status=status.HTTP_404_NOT_FOUND)
        return Response(_payload(problem, request.user))

    def post(self, request, pk: int):
        problem = self._get_problem(pk)
        if not problem:
            return Response({"detail": "Problem not found"}, status=status.HTTP_404_NOT_FOUND)

        if problem.status not in ("pending_approval", "approved"):
            return Response(
                {"detail": "The 8D must be submitted before final approvals can be recorded."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        role = request.data.get("role")
        comments = (request.data.get("comments") or "").strip()
        if role not in {"quality", "manufacturing", "production", "maintenance"}:
            return Response({"detail": "Invalid approval role."}, status=status.HTTP_400_BAD_REQUEST)
        if not comments:
            return Response({"detail": "Approval comments are required."}, status=status.HTTP_400_BAD_REQUEST)

        now = timezone.now()

        if role == "quality":
            if not ProblemService._is_quality_manager(request.user):
                return Response({"detail": "Only a Quality Manager can approve this section."}, status=status.HTTP_403_FORBIDDEN)
            if not problem.approved_at:
                problem.approved_by = request.user
                problem.approved_at = now
                problem.approval_comments = comments
                problem.save(update_fields=["approved_by", "approved_at", "approval_comments", "updated_at"])
        else:
            field_map = {
                "manufacturing": ("manufacturing_approver", "manufacturing_approved_at"),
                "production": ("production_approver", "production_approved_at"),
                "maintenance": ("maintenance_approver", "maintenance_approved_at"),
            }
            approver_field, approved_at_field = field_map[role]
            approver = getattr(problem, approver_field)
            if not approver:
                return Response({"detail": f"{role.title()} approver is not assigned."}, status=status.HTTP_400_BAD_REQUEST)
            if approver.id != request.user.id:
                return Response({"detail": "Only the assigned approver can approve this section."}, status=status.HTTP_403_FORBIDDEN)
            if not getattr(problem, approved_at_field):
                setattr(problem, approved_at_field, now)
                problem.save(update_fields=[approved_at_field, "updated_at"])
                _save_department_comment(problem, role, comments, request.user)

        problem = self._get_problem(pk)
        _sync_status(problem)
        problem = self._get_problem(pk)
        return Response(_payload(problem, request.user))
