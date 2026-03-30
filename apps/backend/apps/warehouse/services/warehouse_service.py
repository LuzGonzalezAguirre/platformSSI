import json
import hashlib
from django.core.cache import cache
from django.conf import settings
from .plex_client import PlexClient, PlexProxyError


class WarehouseService:
    """
    Orquesta las consultas al proxy Plex con cache Redis.
    Nunca expone PlexClient ni httpx hacia afuera.
    """

    def __init__(self):
        self.client = PlexClient()
        self.ttl    = getattr(settings, "PLEX_CACHE_TTL", 300)

    def _cache_key(self, operation: str, **params) -> str:
        raw = json.dumps({"op": operation, **params}, sort_keys=True)
        return f"plex:{hashlib.md5(raw.encode()).hexdigest()}"

    def _get_or_fetch(self, operation: str, fetch_fn, **params) -> list:
        key  = self._cache_key(operation, **params)
        data = cache.get(key)
        if data is not None:
            return data
        data = fetch_fn()
        cache.set(key, data, timeout=self.ttl)
        return data

    def get_part_revisions(self, part_no: str) -> list:
        return self._get_or_fetch(
            "part_revisions",
            lambda: self.client.get_part_revisions(part_no),
            part_no=part_no,
        )

    def get_bom_hierarchy(self, part_no: str, revision: str) -> list:
        return self._get_or_fetch(
            "bom_hierarchy",
            lambda: self.client.get_bom_hierarchy(part_no, revision),
            part_no=part_no,
            revision=revision,
        )

    def get_bom_ctb(self, part_no: str, revision: str, need: int) -> list:
        return self._get_or_fetch(
            "bom_ctb",
            lambda: self.client.get_bom_ctb(part_no, revision, need),
            part_no=part_no,
            revision=revision,
            need=need,
        )

    def get_demand(self, customer_no: int | None, release_status: str) -> list:
        return self._get_or_fetch(
            "demand",
            lambda: self.client.get_demand(customer_no, release_status),
            customer_no=customer_no,
            release_status=release_status,
        )