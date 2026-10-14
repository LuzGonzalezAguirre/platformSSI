"""Read-only inspection flag report. Source of truth: CCS through Q-Wall proxy."""
from datetime import date
from rest_framework.views import APIView
from rest_framework.response import Response
from apps.permissions.drf import QualityModulePermission
from apps.quality.repositories.qwall_repository import QWallRepository
from apps.quality.repositories.flag_photo_repository import FlagPhotoRepository


class FlagReportView(APIView):
    permission_classes = [QualityModulePermission]
    http_method_names = ["get", "head", "options"]

    def get(self, request):
        try:
            start = date.fromisoformat(request.query_params["start_date"])
            end = date.fromisoformat(request.query_params["end_date"])
            if start > end:
                return Response({"detail": "El rango de fechas no es válido."}, status=400)
            bu_param = request.query_params.get("bu_id")
            bu_id = int(bu_param) if bu_param else None
            if bu_id is not None and bu_id <= 0:
                raise ValueError("Invalid BU")
        except (KeyError, ValueError, TypeError):
            return Response({"detail": "start_date, end_date (YYYY-MM-DD) y bu_id deben ser válidos."}, status=400)

        try:
            rows = QWallRepository.get_piece_flags(start, end, bu_id)
        except ValueError as exc:
            return Response({"detail": str(exc)}, status=502)
        except Exception:
            return Response({"detail": "No fue posible consultar los flags en CCS."}, status=502)
        # A running older Windows proxy can still return only flag_id/comment.
        # Never show misleading empty serials and photos in that case.
        if rows and not {"part_number", "total_photos", "point_name", "inspection_started_at", "created_at"}.issubset(rows[0]):
            return Response({
                "detail": "El Q-Wall Proxy sigue usando el contrato anterior de /piece-flags. Actualiza y reinicia el servicio del host Windows."
            }, status=502)
        return Response({"data": rows, "count": len(rows)})


class FlagPhotosView(APIView):
    permission_classes = [QualityModulePermission]
    http_method_names = ["get", "head", "options"]

    def get(self, request, flag_id: int):
        if flag_id <= 0:
            return Response({"detail": "flag_id inválido."}, status=400)
        try:
            return Response(FlagPhotoRepository.get_photos(flag_id))
        except Exception:
            return Response({"detail": "No fue posible consultar las fotografías de este Flag."}, status=502)
