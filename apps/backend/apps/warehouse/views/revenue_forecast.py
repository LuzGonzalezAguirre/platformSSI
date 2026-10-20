from datetime import date
from rest_framework import status
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView
from apps.warehouse.services.warehouse_service import WarehouseService
from apps.warehouse.services.plex_client import PlexProxyError

class RevenueForecastView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        start = request.query_params.get("start_date")
        end = request.query_params.get("end_date")
        if not start or not end:
            return Response({"detail": "start_date and end_date are required"}, status=400)
        try:
            a, b = date.fromisoformat(start), date.fromisoformat(end)
            if a > b or (b - a).days > 180:
                raise ValueError("range")
            customer = request.query_params.get("customer_no")
            customer_no = int(customer) if customer else None
            release_status = request.query_params.get("status", "All")
            if release_status not in ("All", "Open", "History"):
                return Response({"detail": "Invalid status"}, status=400)
        except (ValueError, TypeError):
            return Response({"detail": "Invalid dates, range or customer"}, status=400)
        try:
            return Response(WarehouseService().get_revenue_forecast(
                start, end, customer_no, release_status))
        except PlexProxyError as exc:
            return Response({"detail": str(exc)}, status=status.HTTP_502_BAD_GATEWAY)

class ShippingRevenueSummaryView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        start = request.query_params.get("start_date")
        end = request.query_params.get("end_date")
        try:
            a, b = date.fromisoformat(start), date.fromisoformat(end)
            if a > b or (b - a).days > 180:
                raise ValueError("range")
        except (ValueError, TypeError):
            return Response({"detail": "Invalid dates or range"}, status=400)
        customer = request.query_params.get("customer_no")
        try:
            customer_no = int(customer) if customer else None
        except ValueError:
            return Response({"detail": "Invalid customer_no"}, status=400)
        try:
            return Response(WarehouseService().get_shipping_revenue_summary(start, end, customer_no))
        except PlexProxyError as exc:
            return Response({"detail": str(exc)}, status=status.HTTP_502_BAD_GATEWAY)
