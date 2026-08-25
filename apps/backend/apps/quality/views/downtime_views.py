# apps/quality/views/downtime_views.py
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated

from apps.quality.serializers import (
    DowntimeLogSerializer,
    DowntimeTrendPointSerializer,
    DowntimeTrendQuerySerializer,
    DowntimeSummaryRowSerializer,
    DowntimeCustomerRowSerializer,
)
from apps.quality.filters import DowntimeFilterSerializer
from apps.ssi_common.filters.rbac import get_allowed_bu_for_user
from apps.quality.services import downtime_service


class DowntimeSummaryView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        filter_serializer = DowntimeFilterSerializer(data=request.query_params)
        filter_serializer.is_valid(raise_exception=True)
        filter_ctx = filter_serializer.to_filter_context()
        filter_ctx = filter_ctx.restricted_to_bu(get_allowed_bu_for_user(request.user))

        try:
            result = downtime_service.get_summary(filter_ctx)
        except downtime_service.DowntimeServiceError as exc:
            return Response({"error": str(exc)}, status=400)

        serializer = DowntimeSummaryRowSerializer(result["rows"], many=True)
        customer_serializer = DowntimeCustomerRowSerializer(
            result["by_customer"], many=True,
        )
        return Response({
            "date_from": result["date_from"],
            "date_to": result["date_to"],
            "rows": serializer.data,
            "by_customer": customer_serializer.data,
        })


class DowntimeLogsView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        filter_serializer = DowntimeFilterSerializer(data=request.query_params)
        filter_serializer.is_valid(raise_exception=True)
        filter_ctx = filter_serializer.to_filter_context()
        filter_ctx = filter_ctx.restricted_to_bu(get_allowed_bu_for_user(request.user))

        try:
            result = downtime_service.get_logs(filter_ctx)
        except downtime_service.DowntimeServiceError as exc:
            return Response({"error": str(exc)}, status=400)

        serializer = DowntimeLogSerializer(result["results"], many=True)
        return Response({
            "date_from": result["date_from"],
            "date_to": result["date_to"],
            "count": result["count"],
            "total_hours": result["total_hours"],
            "results": serializer.data,
        })


class DowntimeTrendView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        query_serializer = DowntimeTrendQuerySerializer(data=request.query_params)
        query_serializer.is_valid(raise_exception=True)
        params = query_serializer.validated_data

        try:
            result = downtime_service.get_trend(
                granularity=params["granularity"],
                end_date=params.get("end_date"),
            )
        except downtime_service.DowntimeServiceError as exc:
            return Response({"error": str(exc)}, status=400)

        serializer = DowntimeTrendPointSerializer(result["points"], many=True)
        return Response({
            "granularity": result["granularity"],
            "date_from": result["date_from"],
            "date_to": result["date_to"],
            "points": serializer.data,
        })