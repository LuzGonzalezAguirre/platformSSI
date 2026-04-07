from datetime import datetime
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from apps.maintenance.services.work_requests_service import WorkRequestsService


class WorkRequestsDashboardView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        start = request.query_params.get("start_date")
        end   = request.query_params.get("end_date")
        if not start or not end:
            return Response({"detail": "start_date and end_date required."}, status=400)
        try:
            datetime.strptime(start, "%Y-%m-%d")
            datetime.strptime(end,   "%Y-%m-%d")
        except ValueError:
            return Response({"detail": "Invalid date format."}, status=400)
        data = WorkRequestsService.get_dashboard(start, end)
        return Response(data)