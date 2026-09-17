from rest_framework import status
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView
from django.core.exceptions import PermissionDenied, ValidationError

from apps.quality.models import Problem, ProblemControlSettings
from apps.quality.serializers import ProblemDetailSerializer
from apps.quality.services.problem_service import ProblemService


class ProblemSubmitForFinalApprovalView(APIView):
    """Submit an 8D only when all four approval owners are available."""

    permission_classes = [IsAuthenticated]

    def post(self, request, pk: int):
        try:
            problem = Problem.objects.filter(pk=pk).first()
            if not problem:
                return Response({"detail": "Problem not found."}, status=status.HTTP_404_NOT_FOUND)

            missing = []
            if not ProblemControlSettings.load().quality_manager_id:
                missing.append("Quality Manager (configure it in Problem Control Settings)")
            if not problem.manufacturing_approver_id:
                missing.append("Manufacturing approver")
            if not problem.production_approver_id:
                missing.append("Production approver")
            if not problem.maintenance_approver_id:
                missing.append("Maintenance approver")

            if missing:
                return Response(
                    {"detail": "Approval routing incomplete: " + ", ".join(missing)},
                    status=status.HTTP_400_BAD_REQUEST,
                )

            problem = ProblemService.submit_for_approval(pk, request.user)
            return Response(ProblemDetailSerializer(problem).data)

        except PermissionDenied as exc:
            return Response({"detail": str(exc)}, status=status.HTTP_403_FORBIDDEN)
        except ValidationError as exc:
            return Response({"detail": str(exc)}, status=status.HTTP_400_BAD_REQUEST)
        except Exception as exc:
            return Response({"detail": str(exc)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)
