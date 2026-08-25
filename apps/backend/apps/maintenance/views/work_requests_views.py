from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from apps.maintenance.services.work_requests_service import WorkRequestsService
from apps.maintenance.filters import MaintenanceFilterSerializer
from apps.ssi_common.filters.rbac import get_allowed_bu_for_user


class WorkRequestsDashboardView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        filter_serializer = MaintenanceFilterSerializer(data=request.query_params)
        filter_serializer.is_valid(raise_exception=True)
        filter_ctx = filter_serializer.to_filter_context()
        filter_ctx = filter_ctx.restricted_to_bu(get_allowed_bu_for_user(request.user))

        data = WorkRequestsService.get_dashboard(filter_ctx)
        return Response(data)