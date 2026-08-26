"""
Fuente única de opciones para el FilterBar compartido entre production,
quality y maintenance (BU, workcenter, shift).

Reutiliza list_active_workcenters() de quality (dueño real del catálogo
Postgres de workcenters, alimentado por sync_workcenters) en vez de
duplicar esa query aquí.
"""
from django.core.cache import cache
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated

from apps.ssi_common.filters.choices import BU_CHOICES
from apps.ssi_common.filters.shift_calendar import ALL_SHIFTS
from apps.quality.services.downtime_workcenter_service import (
    list_active_workcenters,
    list_cogp_workcenters,
)

# BUs activas hoy en planta para el selector de filtros. BusinessUnit
# (customer_part_mapping.py) sigue teniendo las 7 -- Harley-Davidson,
# Eaton y Speed siguen siendo válidas para COGP/Scrap Rate/sync de Plex,
# solo no se muestran como opción de filtro mientras no estén activas
# operativamente. Ajustar esta lista, no BusinessUnit, si el negocio
# reactiva alguna.
ACTIVE_FILTER_BU_CODES = {"VOLVO", "CUMMINS", "TULC", "JOHN_DEERE", "EATON"}


class FilterChoicesView(APIView):
    permission_classes = [IsAuthenticated]
    CACHE_TTL = 1800

    def get(self, request):
        scope = request.query_params.get("scope", "default")
        cache_key = f"common:filter_choices:v2:{scope}"

        cached = cache.get(cache_key)
        if cached:
            return Response(cached)

        workcenters = (
            list_cogp_workcenters() if scope == "cogp" else list_active_workcenters()
        )

        data = {
            "bu": [
                {"value": code, "label": label}
                for code, label in BU_CHOICES
                if code in ACTIVE_FILTER_BU_CODES
            ],
            "shift": [{"value": s, "label": s} for s in ALL_SHIFTS],
            "workcenter": [
                {"value": wc.name, "label": wc.name}
                for wc in workcenters
            ],
        }
        cache.set(cache_key, data, self.CACHE_TTL)
        return Response(data)