# apps/quality/views/rejection_views.py
from django.http import HttpResponse
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from apps.quality.services.rejection_service import RejectionService
from apps.quality.services.rejection_pdf_service import build_rejection_pdf
from apps.quality.repositories.rejection_repository import RejectionRepository


class RejectionReportView(APIView):
    """
    Reporte de rechazos.
    CÓDIGO ORIGINAL QUE FUNCIONABA — Solo GET.
    """
    permission_classes = [IsAuthenticated]

    def get(self, request):
        start = request.query_params.get("start_date")
        end = request.query_params.get("end_date")
        bu_id = request.query_params.get("bu_id")
        include_test = request.query_params.get("include_test", "false").lower() == "true"
        lang = request.query_params.get("lang", "es")
        if lang not in ("es", "en"):
            lang = "es"

        if not start or not end:
            return Response({"detail": "start_date y end_date requeridos."}, status=400)

        try:
            data = RejectionService().get_tree(
                start, end, int(bu_id) if bu_id else None,
                include_test=include_test, locale=lang,
            )
            return Response(data)
        except Exception as e:
            return Response({"detail": str(e)}, status=502)


class RejectionPhotoView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request, inspection_id: int):
        try:
            data = RejectionService().get_photo(inspection_id)
            return Response(data)
        except Exception as e:
            return Response({"detail": str(e)}, status=502)


class RejectionReportPDFView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        start = request.query_params.get("start_date")
        end = request.query_params.get("end_date")
        bu_id = request.query_params.get("bu_id")
        lang = request.query_params.get("lang", "es")

        if lang not in ("es", "en"):
            lang = "es"

        if not start or not end:
            return Response({"detail": "start_date y end_date requeridos."}, status=400)

        try:
            svc = RejectionService()
            tree = svc.get_tree(start, end, int(bu_id) if bu_id else None)

            repo = RejectionRepository()
            for node in tree:
                for serial in node["serials"]:
                    for insp in serial["inspections"]:
                        if insp.get("has_photo"):
                            try:
                                photo = repo.get_rejection_photo(insp["inspection_id"])
                                insp["photo_b64"] = photo.get("photo_b64")
                            except Exception:
                                insp["photo_b64"] = None
                        else:
                            insp["photo_b64"] = None

            pdf_bytes = build_rejection_pdf(tree, start, end, lang)

            filename = f"rechazos_{start}_{end}.pdf"
            response = HttpResponse(pdf_bytes, content_type="application/pdf")
            response["Content-Disposition"] = f'attachment; filename="{filename}"'
            return response

        except Exception as e:
            return Response({"detail": str(e)}, status=502)