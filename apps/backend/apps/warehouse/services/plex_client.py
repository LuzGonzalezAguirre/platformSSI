import httpx
from django.conf import settings


class PlexProxyError(Exception):
    pass


class PlexClient:
    """
    Cliente HTTP hacia el Plex ODBC Proxy.
    Única capa del backend que conoce la existencia del proxy.
    Todos los demás servicios consumen esta clase, nunca httpx directamente.
    """

    def __init__(self):
        self.base_url = settings.PLEX_PROXY_URL.rstrip("/")
        self.secret   = settings.PLEX_PROXY_SECRET
        self.timeout  = 60.0

    def _headers(self) -> dict:
        return {
            "Authorization": f"Bearer {self.secret}",
            "Content-Type":  "application/json",
        }
    def _get(self, endpoint: str) -> dict:
        url = f"{self.base_url}/{endpoint.lstrip('/')}"
        try:
            response = httpx.get(
                url,
                headers=self._headers(),
                timeout=self.timeout,
            )
            response.raise_for_status()
            return response.json()
        except httpx.TimeoutException:
            raise PlexProxyError(f"Timeout connecting to Plex proxy at {url}")
        except httpx.HTTPStatusError as e:
            raise PlexProxyError(f"Plex proxy error {e.response.status_code}: {e.response.text}")
        except Exception as e:
            raise PlexProxyError(f"Unexpected error calling Plex proxy: {str(e)}")

    def _post(self, endpoint: str, payload: dict) -> list:
        url = f"{self.base_url}/{endpoint.lstrip('/')}"
        try:
            response = httpx.post(
                url,
                json=payload,
                headers=self._headers(),
                timeout=self.timeout,
            )
            response.raise_for_status()
            return response.json().get("data", [])
        except httpx.TimeoutException:
            raise PlexProxyError(f"Timeout connecting to Plex proxy at {url}")
        except httpx.HTTPStatusError as e:
            raise PlexProxyError(f"Plex proxy error {e.response.status_code}: {e.response.text}")
        except Exception as e:
            raise PlexProxyError(f"Unexpected error calling Plex proxy: {str(e)}")

    def get_shelf_life(self) -> list:
        return self._post("shelf-life", {})

    def get_part_revisions(self, part_no: str) -> list:
        return self._post("part-revisions", {"part_no": part_no})

    def get_bom_hierarchy(self, part_no: str, revision: str, max_levels: int = 10) -> list:
        return self._post("bom-hierarchy", {
            "part_no":    part_no,
            "revision":   revision,
            "max_levels": max_levels,
        })

    def get_bom_ctb(self, part_no: str, revision: str, need: int = 500, max_levels: int = 10) -> list:
        return self._post("bom-ctb", {
            "part_no":    part_no,
            "revision":   revision,
            "need":       need,
            "max_levels": max_levels,
        })

    def get_demand(
        self, customer_no: int | None = None, release_status: str = "Open",
        ship_date_from: str | None = None, ship_date_to: str | None = None,
        po: str | None = None, customer_part_no: str | None = None,
        release_types: list[str] | None = None,
        include_all_customers: bool = False,
    ) -> list:
        return self._post("demand", {
            "customer_no": customer_no,
            "release_status": release_status,
            "start_date": ship_date_from,
            "end_date": ship_date_to,
            "include_all_customers": include_all_customers,
            "po": po,
            "customer_part_no": customer_part_no,
            "release_types": release_types,
        })
    def get_delivery_performance(self, start_date: str, end_date: str) -> list:
        return self._post("delivery-performance", {"start_date": start_date, "end_date": end_date})

    def get_revenue_forecast(self, start_date: str, end_date: str, customer_no: int | None, release_status: str, debug: bool = False) -> list:
        return self._post("revenue-forecast", {
            "start_date": start_date, "end_date": end_date,
            "customer_no": customer_no, "release_status": release_status, "debug": debug,
        })

    def get_shipping_revenue_summary(self, start_date: str, end_date: str, customer_no: int | None = None) -> list:
        return self._post("shipping-revenue-summary", {
            "customer_no": customer_no, "start_date": start_date, "end_date": end_date,
        })
