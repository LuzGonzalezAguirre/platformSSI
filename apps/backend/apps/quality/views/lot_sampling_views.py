"""Authenticated Q-Wall lot setup; persistence and sampling matrix live in CCS."""
import requests
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.quality.views.qwall_settings_views import (
    _has_access, _forbidden, _proxy_get, PROXY_URL, HEADERS, TIMEOUT,
)


class QWallSamplingMatrixView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        if not _has_access(request):
            return _forbidden()
        return _proxy_get('/settings/lot-sampling/matrix')


class QWallLotConfigurationView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request, bu_id):
        if not _has_access(request):
            return _forbidden()
        return _proxy_get(f'/settings/lot-sampling/{bu_id}')

    def put(self, request, bu_id):
        if not _has_access(request):
            return _forbidden()
        try:
            resp = requests.put(
                f'{PROXY_URL}/settings/lot-sampling/{bu_id}',
                json=request.data, headers=HEADERS, timeout=TIMEOUT,
            )
            resp.raise_for_status()
            return Response(resp.json())
        except requests.HTTPError as exc:
            return Response({'error': exc.response.json().get('detail', exc.response.text)}, status=exc.response.status_code)
        except requests.RequestException as exc:
            return Response({'error': str(exc)}, status=502)
