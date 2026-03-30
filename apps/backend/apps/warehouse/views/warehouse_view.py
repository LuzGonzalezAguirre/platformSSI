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
            customer_no    = request.query_params.get("customer_no")
            release_status = request.query_params.get("status", "Open")
            data = WarehouseService().get_demand(
                customer_no=int(customer_no) if customer_no else None,
                release_status=release_status,
            )
            return Response(DemandSerializer(data, many=True).data)
        except PlexProxyError as e:
            return Response({"detail": str(e)}, status=status.HTTP_502_BAD_GATEWAY)