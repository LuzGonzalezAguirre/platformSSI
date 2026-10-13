from datetime import date

from rest_framework import status
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.warehouse.services.plex_client import PlexProxyError
from apps.warehouse.services.warehouse_service import WarehouseService
from apps.warehouse.serializers.warehouse import (
    PartRevisionSerializer,
    BomHierarchySerializer,
    BomCtbSerializer,
    DemandSerializer,
)


class PartRevisionsView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request, part_no: str):
        try:
            data = WarehouseService().get_part_revisions(part_no)
            return Response(PartRevisionSerializer(data, many=True).data)
        except PlexProxyError as e:
            return Response({"detail": str(e)}, status=status.HTTP_502_BAD_GATEWAY)


class BomHierarchyView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request, part_no: str, revision: str):
        try:
            data = WarehouseService().get_bom_hierarchy(part_no, revision)
            return Response(BomHierarchySerializer(data, many=True).data)
        except PlexProxyError as e:
            return Response({"detail": str(e)}, status=status.HTTP_502_BAD_GATEWAY)


class BomCtbView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request, part_no: str, revision: str):
        try:
            need = int(request.query_params.get("need", 500))
            data = WarehouseService().get_bom_ctb(part_no, revision, need)
            return Response(BomCtbSerializer(data, many=True).data)
        except PlexProxyError as e:
            return Response({"detail": str(e)}, status=status.HTTP_502_BAD_GATEWAY)
        except ValueError:
            return Response({"detail": "need must be an integer"}, status=status.HTTP_400_BAD_REQUEST)


class DemandView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        try:
            params = request.query_params
            customer_no = params.get("customer_no")
            release_status = params.get("status", "Open")
            if release_status not in ("Open", "History", "All"):
                return Response({"detail": "Invalid release status"}, status=status.HTTP_400_BAD_REQUEST)

            try:
                customer_no = int(customer_no) if customer_no else None
            except ValueError:
                return Response({"detail": "customer_no must be an integer"}, status=status.HTTP_400_BAD_REQUEST)

            start_text = params.get("ship_date_from") or None
            end_text = params.get("ship_date_to") or None
            if bool(start_text) != bool(end_text):
                return Response({"detail": "Both ship dates are required"}, status=status.HTTP_400_BAD_REQUEST)
            if start_text:
                try:
                    start = date.fromisoformat(start_text)
                    end = date.fromisoformat(end_text)
                except ValueError:
                    return Response({"detail": "Dates must use YYYY-MM-DD"}, status=status.HTTP_400_BAD_REQUEST)
                if start > end or (end - start).days > 180:
                    return Response({"detail": "Ship date range must be 0–180 days"}, status=status.HTTP_400_BAD_REQUEST)

            release_types = params.getlist("release_types")
            if not release_types:
                release_types = params.getlist("release_types[]")
            allowed_types = {
                "Firm (862)", "CZ Ship", "Forecast", "HOLD", "Non-MRP Release",
                "Pass Through", "Planning (830)", "Projected", "Ramp Plan",
            }
            if any(kind not in allowed_types for kind in release_types):
                return Response({"detail": "Invalid release type"}, status=status.HTTP_400_BAD_REQUEST)

            po = (params.get("po") or "").strip() or None
            customer_part_no = (params.get("customer_part_no") or "").strip() or None
            if any(len(value) > 100 for value in (po, customer_part_no) if value):
                return Response({"detail": "Search filter is too long"}, status=status.HTTP_400_BAD_REQUEST)

            data = WarehouseService().get_demand(
                customer_no=customer_no,
                release_status=release_status,
                ship_date_from=start_text,
                ship_date_to=end_text,
                po=po,
                customer_part_no=customer_part_no,
                release_types=release_types,
            )
            return Response(DemandSerializer(data, many=True).data)
        except PlexProxyError as e:
            return Response({"detail": str(e)}, status=status.HTTP_502_BAD_GATEWAY)