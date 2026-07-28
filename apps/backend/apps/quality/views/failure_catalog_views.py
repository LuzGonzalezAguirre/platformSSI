# apps/quality/views/failure_catalog_views.py
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from rest_framework import status

from apps.quality.services.failure_catalog_service import FailureCatalogService


class CatalogStructureView(APIView):
    """
    GET /quality/catalog/structure/
    Devuelve BusinessUnits → InspectionPoints → FailModes con imágenes.
    """
    permission_classes = [IsAuthenticated]

    def get(self, request):
        lang = request.query_params.get("lang", "es")
        if lang not in ("es", "en"):
            lang = "es"
        try:
            data = FailureCatalogService.get_structure(locale=lang)
            return Response({"data": data})
        except Exception as e:
            return Response({"error": str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


class FailureCatalogView(APIView):
    """
    GET  /quality/catalog/          → lista de puntos de inspección con modos de falla e imágenes
    POST /quality/catalog/          → guardar/actualizar imagen de un modo de falla
    DELETE /quality/catalog/        → eliminar imagen de un modo de falla
    """
    permission_classes = [IsAuthenticated]

    def get(self, request):
        days = int(request.query_params.get("days", 180))
        days = max(30, min(days, 365))
        try:
            data = FailureCatalogService.get_catalog(days=days)
            return Response({"data": data})
        except Exception as e:
            return Response({"error": str(e)}, status=status.HTTP_502_BAD_GATEWAY)

    def post(self, request):
        inspection_point = (request.data.get("inspection_point") or "").strip()
        failure_mode     = (request.data.get("failure_mode") or "").strip()
        image_data       = request.data.get("image_data", "")
        image_mime       = request.data.get("image_mime", "")

        if not inspection_point or not failure_mode:
            return Response(
                {"error": "inspection_point y failure_mode son requeridos."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        if not image_data:
            return Response(
                {"error": "image_data es requerido."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        obj = FailureCatalogService.save_image(
            inspection_point, failure_mode, image_data, image_mime, request.user
        )
        return Response({
            "inspection_point": obj.inspection_point,
            "failure_mode":     obj.failure_mode,
            "has_image":        True,
            "updated_at":       obj.updated_at.isoformat(),
        }, status=status.HTTP_200_OK)

    def delete(self, request):
        inspection_point = (request.data.get("inspection_point") or "").strip()
        failure_mode     = (request.data.get("failure_mode") or "").strip()

        if not inspection_point or not failure_mode:
            return Response(
                {"error": "inspection_point y failure_mode son requeridos."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        deleted = FailureCatalogService.delete_image(inspection_point, failure_mode)
        if not deleted:
            return Response({"error": "Imagen no encontrada."}, status=status.HTTP_404_NOT_FOUND)
        return Response(status=status.HTTP_204_NO_CONTENT)