from django.utils import timezone
from rest_framework import status
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.quality.models import Problem, ProblemNote, ProblemControlSettings


APPROVAL_NOTE_PREFIX = "[8D_APPROVAL:{role}] "
REJECTION_NOTE_PREFIX = "[8D_REJECTION:{role}] "


def _user_data(user):
    if not user:
        return None
    return {
        "id": user.id,
        "username": user.employee_id,
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


def _get_rejection(problem, role):
    prefix = REJECTION_NOTE_PREFIX.format(role=role)
    note = (
        ProblemNote.objects.filter(problem=problem, step="step8", text__startswith=prefix)
        .order_by("-created_at")
        .first()
    )
    if not note:
        return None
    return {
        "comments": note.text[len(prefix):],
        "rejected_at": note.created_at,
        "rejected_by": _user_data(note.created_by),
    }


def _save_rejection(problem, role, comment, user):
    ProblemNote.objects.create(
        problem=problem,
        step="step8",
        text=f"{REJECTION_NOTE_PREFIX.format(role=role)}{comment}",
        created_by=user,
    )


def _clear_rejections(problem):
    ProblemNote.objects.filter(
        problem=problem,
        step="step8",
        text__startswith="[8D_REJECTION:",
    ).delete()


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
    settings_obj = ProblemControlSettings.load()
    configured_quality_manager = settings_obj.quality_manager
    quality_display_user = problem.approved_by if problem.approved_at else configured_quality_manager

    roles = [
        {
            "role": "quality",
            "label": "Quality Manager",
            "approver": _user_data(quality_display_user),
            "approved_at": problem.approved_at,
            "comments": problem.approval_comments or "",
            "can_approve": (
                problem.status == "pending_approval"
                and problem.approved_at is None
                and configured_quality_manager is not None
                and configured_quality_manager.id == request_user.id
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
    for item in roles:
        rejection = _get_rejection(problem, item["role"])
        item["rejected_at"] = rejection["rejected_at"] if rejection else None
        item["rejected_by"] = rejection["rejected_by"] if rejection else None
        item["rejection_comments"] = rejection["comments"] if rejection else ""
        item["can_reject"] = item["can_approve"]

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
        decision = (request.data.get("decision") or "approve").strip().lower()
        comments = (request.data.get("comments") or "").strip()
        if role not in {"quality", "manufacturing", "production", "maintenance"}:
            return Response({"detail": "Invalid approval role."}, status=status.HTTP_400_BAD_REQUEST)
        if decision not in {"approve", "reject"}:
            return Response({"detail": "decision must be approve or reject."}, status=status.HTTP_400_BAD_REQUEST)
        if not comments:
            return Response(
                {"detail": "Approval comments are required." if decision == "approve" else "Rejection reason is required."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        # A rejection immediately reopens the 8D for editing. Existing approvals
        # remain recorded until the 8D is edited or explicitly withdrawn.
        if decision == "reject":
            authorized = False
            if role == "quality":
                configured_manager = ProblemControlSettings.load().quality_manager
                authorized = configured_manager is not None and configured_manager.id == request.user.id
            else:
                approver_field = {
                    "manufacturing": "manufacturing_approver",
                    "production": "production_approver",
                    "maintenance": "maintenance_approver",
                }[role]
                approver = getattr(problem, approver_field)
                authorized = approver is not None and approver.id == request.user.id

            if not authorized:
                return Response({"detail": "Only the assigned approver can reject this section."}, status=status.HTTP_403_FORBIDDEN)

            _save_rejection(problem, role, comments, request.user)

            # Un solo rechazo cancela inmediatamente el ciclo completo de
            # aprobación. El 8D vuelve a Draft para que pueda editarse sin
            # esperar decisiones de los demás aprobadores.
            problem.approved_by = None
            problem.approved_at = None
            problem.approval_comments = ""
            problem.manufacturing_approved_at = None
            problem.production_approved_at = None
            problem.maintenance_approved_at = None
            problem.status = "draft"
            problem.save(update_fields=[
                "approved_by",
                "approved_at",
                "approval_comments",
                "manufacturing_approved_at",
                "production_approved_at",
                "maintenance_approved_at",
                "status",
                "updated_at",
            ])

            problem = self._get_problem(pk)
            return Response(_payload(problem, request.user))

        now = timezone.now()

        if role == "quality":
            configured_manager = ProblemControlSettings.load().quality_manager
            if not configured_manager:
                return Response(
                    {"detail": "A Quality Manager has not been configured in Problem Control Settings."},
                    status=status.HTTP_400_BAD_REQUEST,
                )
            if configured_manager.id != request.user.id:
                return Response(
                    {"detail": "Only the Quality Manager configured in Problem Control Settings can approve this section."},
                    status=status.HTTP_403_FORBIDDEN,
                )
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
