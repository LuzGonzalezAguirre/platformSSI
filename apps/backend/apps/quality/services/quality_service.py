import json, hashlib
from django.core.cache import cache
from django.conf import settings
from .plex_client_quality import QualityPlexClient
from apps.warehouse.services.plex_client import PlexProxyError

class QualityService:
    TTL = 300

    def __init__(self):
        self.client = QualityPlexClient()

    def _cache_key(self, start: str, end: str, use_shift: bool) -> str:
        raw = json.dumps({"op": "scrap_detail", "start": start, "end": end, "shift": use_shift}, sort_keys=True)
        return f"plex:{hashlib.md5(raw.encode()).hexdigest()}"

    def get_scrap_detail(self, start_date: str, end_date: str, use_shift: bool = True) -> dict:
        key  = self._cache_key(start_date, end_date, use_shift)
        data = cache.get(key)
        if data is not None:
            return data
        data = self.client.get_scrap_detail(start_date, end_date, use_shift)
        cache.set(key, data, timeout=self.TTL)
        return data