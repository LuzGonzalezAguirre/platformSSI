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

    def get_demand(
        self, customer_no: int | None, release_status: str,
        ship_date_from: str | None = None, ship_date_to: str | None = None,
        po: str | None = None, customer_part_no: str | None = None,
        release_types: list[str] | None = None,
    ) -> list:
        params = {
            "customer_no": customer_no,
            "release_status": release_status,
            "ship_date_from": ship_date_from,
            "ship_date_to": ship_date_to,
            "po": po,
            "customer_part_no": customer_part_no,
            "release_types": sorted(set(release_types or [])),
        }
        return self._get_or_fetch(
            "demand",
            lambda: self.client.get_demand(**params),
            **params,
        )
    def get_revenue_forecast(self, start_date: str, end_date: str,
                             customer_no: int | None, release_status: str, debug: bool = False) -> list:
        if debug:
            # Never serve stale audit metadata while investigating live Plex releases.
            return self.client.get_revenue_forecast(start_date, end_date, customer_no, release_status, debug)
        return self._get_or_fetch(
            "revenue_forecast_active_v2",
            lambda: self.client.get_revenue_forecast(start_date, end_date, customer_no, release_status, debug),
            start_date=start_date, end_date=end_date,
            customer_no=customer_no, release_status=release_status, debug=debug,
        )

    def get_shipping_revenue_daily(self, start_date: str, end_date: str, customer_no: int | None = None) -> list:
        return self._get_or_fetch(
            "shipping_revenue_daily_v1",
            lambda: self.client.get_shipping_revenue_daily(start_date, end_date, customer_no),
            start_date=start_date, end_date=end_date, customer_no=customer_no,
        )

    def get_shipping_revenue_summary(self, start_date: str, end_date: str, customer_no: int | None = None) -> list:
        return self._get_or_fetch(
            "shipping_revenue_summary",
            lambda: self.client.get_shipping_revenue_summary(start_date, end_date, customer_no),
            start_date=start_date, end_date=end_date, customer_no=customer_no,
        )
