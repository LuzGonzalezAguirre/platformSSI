"""PostgreSQL-backed Q-Wall lot configuration and GL-QA 02 sampling matrix."""
import requests
from django.db import transaction
from django.db.models import Q
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.quality.models import QWallLotSetting, QWallLotModelSetting, QWallSamplingCell
from apps.quality.views.qwall_settings_views import _has_access, _forbidden, PROXY_URL, HEADERS, TIMEOUT


def _positive_int(value):
    if isinstance(value, bool):
        return None
    try:
        number = int(value)
        return number if number > 0 and str(value).strip() == str(number) else None
    except (TypeError, ValueError):
        return None


def _cell(lot_size, index):
    return QWallSamplingCell.objects.filter(
        lot_min__lte=lot_size, inspection_index=index,
    ).filter(
        Q(lot_max__gte=lot_size) | Q(lot_max__isnull=True)
    ).first()


def _serialize(setting):
    if setting is None:
        return None
    return {
        'bu_id': setting.bu_id,
        'mode': setting.mode,
        'general_lot_size': setting.general_lot_size,
        'inspection_index': setting.inspection_index,
        'enabled': setting.enabled,
        'models': [{'pn_id': m.pn_id, 'lot_size': m.lot_size} for m in setting.models.order_by('pn_id')],
    }


class QWallSamplingMatrixView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        if not _has_access(request):
            return _forbidden()
        cells = list(QWallSamplingCell.objects.order_by('lot_min', 'id').values(
            'lot_min', 'lot_max', 'inspection_index', 'sample_size'
        ))
        return Response({'data': cells})


class QWallLotConfigurationView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request, bu_id):
        if not _has_access(request):
            return _forbidden()
        return Response({'data': _serialize(QWallLotSetting.objects.filter(bu_id=bu_id).prefetch_related('models').first())})

    def put(self, request, bu_id):
        if not _has_access(request):
            return _forbidden()
        data = request.data
        mode = data.get('mode')
        index = data.get('inspection_index')
        enabled = data.get('enabled')
        if mode not in ('GENERAL', 'BY_MODEL') or not QWallSamplingCell.objects.filter(inspection_index=index).exists():
            return Response({'error': 'Modo o índice de inspección inválido.'}, status=400)
        if not isinstance(enabled, bool):
            return Response({'error': 'enabled debe ser booleano.'}, status=400)
        general = _positive_int(data.get('general_lot_size')) if mode == 'GENERAL' else None
        raw_models = data.get('models', [])
        if not isinstance(raw_models, list):
            return Response({'error': 'models debe ser una lista.'}, status=400)
        models = {}
        if mode == 'BY_MODEL':
            for item in raw_models:
                if not isinstance(item, dict):
                    return Response({'error': 'Modelo inválido.'}, status=400)
                pn_id, size = _positive_int(item.get('pn_id')), _positive_int(item.get('lot_size'))
                if pn_id is None or size is None or pn_id in models:
                    return Response({'error': 'Modelo duplicado o tamaño de lote inválido.'}, status=400)
                models[pn_id] = size
        if (mode == 'GENERAL' and general is None) or (mode == 'BY_MODEL' and not models):
            return Response({'error': 'Configura un tamaño de lote válido.'}, status=400)
        if any(_cell(size, index) is None for size in ([general] if mode == 'GENERAL' else models.values())):
            return Response({'error': 'El tamaño de lote no está cubierto por la matriz verificada GL-QA 02.'}, status=400)

        # CCS remains read-only: validate the BU and its model IDs before saving in Postgres.
        try:
            bu_resp = requests.get(f'{PROXY_URL}/settings/business-units', headers=HEADERS, timeout=TIMEOUT)
            bu_resp.raise_for_status()
            if not any(int(b['bu_id']) == bu_id for b in bu_resp.json().get('data', [])):
                return Response({'error': 'Business Unit desconocida.'}, status=400)
            if mode == 'BY_MODEL':
                pn_resp = requests.get(f'{PROXY_URL}/settings/part-numbers', params={'bu_id': bu_id}, headers=HEADERS, timeout=TIMEOUT)
                pn_resp.raise_for_status()
                valid_ids = {int(p['pn_id']) for p in pn_resp.json().get('data', []) if int(p['bu_id']) == bu_id}
                if not set(models).issubset(valid_ids) or (enabled and set(models) != valid_ids):
                    return Response({'error': 'Configura todos los modelos del BU antes de activar el muestreo.'}, status=400)
        except (requests.RequestException, ValueError, KeyError) as exc:
            return Response({'error': f'No se pudo validar el catálogo CCS: {exc}'}, status=502)

        with transaction.atomic():
            setting, _ = QWallLotSetting.objects.update_or_create(
                bu_id=bu_id, defaults={
                    'mode': mode, 'general_lot_size': general,
                    'inspection_index': index, 'enabled': enabled,
                },
            )
            setting.models.all().delete()
            QWallLotModelSetting.objects.bulk_create([
                QWallLotModelSetting(setting=setting, pn_id=pn_id, lot_size=size)
                for pn_id, size in models.items()
            ])
        return Response({'data': _serialize(setting)})
