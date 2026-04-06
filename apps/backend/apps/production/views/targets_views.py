from datetime import datetime
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status
from rest_framework.permissions import IsAuthenticated
from apps.production.services.targets_service import TargetsService
from apps.production.serializers.targets import (
    BusinessUnitSerializer,
    WeeklyTargetSerializer, WeeklyTargetWriteSerializer,
    WeeklyWIPSerializer, WeeklyWIPWriteSerializer,
)


class BusinessUnitListView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        bus = TargetsService.list_business_units()
        return Response(BusinessUnitSerializer(bus, many=True).data)


class WeeklyTargetView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        week_str = request.query_params.get("week")
        bu_code  = request.query_params.get("bu", "").lower()
        try:
            week_date = datetime.strptime(week_str, "%Y-%m-%d").date()
        except (TypeError, ValueError):
            return Response({"detail": "Param 'week' required (YYYY-MM-DD)."}, status=400)
        obj = TargetsService.get_weekly_target(week_date, bu_code)
        if not obj:
            return Response({})
        return Response(WeeklyTargetSerializer(obj).data)

    def post(self, request):
        serializer = WeeklyTargetWriteSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        d = serializer.validated_data
        obj = TargetsService.save_weekly_target(
            d["week_date"], d["bu_code"], d, request.user
        )
        return Response(WeeklyTargetSerializer(obj).data, status=status.HTTP_200_OK)


class WeeklyWIPView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        week_str = request.query_params.get("week")
        bu_code  = request.query_params.get("bu", "").lower()
        try:
            week_date = datetime.strptime(week_str, "%Y-%m-%d").date()
        except (TypeError, ValueError):
            return Response({"detail": "Param 'week' required (YYYY-MM-DD)."}, status=400)
        obj = TargetsService.get_weekly_wip(week_date, bu_code)
        if not obj:
            return Response({})
        return Response(WeeklyWIPSerializer(obj).data)

    def post(self, request):
        serializer = WeeklyWIPWriteSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        d = serializer.validated_data
        obj = TargetsService.save_weekly_wip(
            d["week_date"], d["bu_code"], d, request.user
        )
        return Response(WeeklyWIPSerializer(obj).data, status=status.HTTP_200_OK)
    
class OEERecordView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        date_str = request.query_params.get("date")
        try:
            record_date = datetime.strptime(date_str, "%Y-%m-%d").date()
        except (TypeError, ValueError):
            return Response({"detail": "Param 'date' required (YYYY-MM-DD)."}, status=400)

        from apps.production.services.targets_service import TargetsService
        record = TargetsService.get_oee(record_date)
        if not record:
            return Response({})
        from apps.production.serializers.targets import OEERecordSerializer
        return Response(OEERecordSerializer(record).data)

    def post(self, request):
        from apps.production.serializers.targets import OEERecordWriteSerializer
        from apps.production.services.targets_service import TargetsService
        serializer = OEERecordWriteSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        d = serializer.validated_data
        record = TargetsService.save_oee(
            d["date"],
            float(d["availability_pct"]),
            float(d["performance_pct"]),
            float(d["quality_pct"]),
            float(d["oee_pct"]),
            request.user,
        )
        from apps.production.serializers.targets import OEERecordSerializer
        return Response(OEERecordSerializer(record).data)