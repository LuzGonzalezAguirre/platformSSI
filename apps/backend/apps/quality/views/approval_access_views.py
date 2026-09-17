from rest_framework import status
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.quality.models import Problem, ProblemControlSettings
from apps.quality.views.approval_views import ProblemFinalApprovalView


def _assigned_approval_user_ids(problem: Problem) -> set[int]:
    settings = ProblemControlSettings.load()
    ids = {
        settings.quality_manager_id,
        problem.manufacturing_approver_id,
        problem.production_approver_id,
        problem.maintenance_approver_id,
    }
    return {user_id for user_id in ids if user_id is not None}


class AssignedProblemFinalApprovalView(ProblemFinalApprovalView):
    """Final approval page/API restricted to the four assigned approvers."""

    permission_classes = [IsAuthenticated]

    def _check_assignment(self, request, pk: int):
        problem = self._get_problem(pk)
        if not problem:
            return None, Response(
                {"detail": "Problem not found"},
                status=status.HTTP_404_NOT_FOUND,
            )

        if request.user.id not in _assigned_approval_user_ids(problem):
            return problem, Response(
                {"detail": "Only assigned approvers can access the final approval workflow."},
                status=status.HTTP_403_FORBIDDEN,
            )

        return problem, None

    def get(self, request, pk: int):
        _, error = self._check_assignment(request, pk)
        if error:
            return error
        return super().get(request, pk)

    def post(self, request, pk: int):
        _, error = self._check_assignment(request, pk)
        if error:
            return error
        return super().post(request, pk)


class MyApprovalAssignmentsView(APIView):
    """Return Problem ids where the current user is one of the four final approvers."""

    permission_classes = [IsAuthenticated]

    def get(self, request):
        settings = ProblemControlSettings.load()

        queryset = Problem.objects.filter(
            status__in=["pending_approval", "approved"]
        ).only(
            "id",
            "manufacturing_approver_id",
            "production_approver_id",
            "maintenance_approver_id",
        )

        assigned_ids = []
        for problem in queryset:
            if request.user.id in {
                settings.quality_manager_id,
                problem.manufacturing_approver_id,
                problem.production_approver_id,
                problem.maintenance_approver_id,
            }:
                assigned_ids.append(problem.id)

        return Response({"problem_ids": assigned_ids})
