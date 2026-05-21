# apps/quality/repositories/plex_lookup_repository.py
import httpx
from django.conf import settings
from django.core.cache import cache


class PlexLookupRepository:
    """
    Repository para lookups de Plex vía plex-proxy.
    
    IMPORTANTE: Estos endpoints NO EXISTEN AÚN en plex-proxy.
    Deberán ser creados siguiendo el patrón existente de plex-proxy.
    """

    PROXY_URL = settings.PLEX_PROXY_URL  # http://host.docker.internal:8001
    PROXY_TOKEN = settings.PLEX_PROXY_TOKEN
    HEADERS = {"Authorization": f"Bearer {PROXY_TOKEN}"}
    TIMEOUT = 15

    @staticmethod
    def get_customers(search: str = None) -> list[dict]:
        """
        Obtener lista de customers desde Plex.
        
        ENDPOINT PENDIENTE: GET /customers?search=xxx
        Response: [{"no": "C123", "name": "Customer Name"}, ...]
        """
        cache_key = f"plex:customers:{search or 'all'}"
        cached = cache.get(cache_key)
        if cached:
            return cached

        params = {"search": search} if search else {}
        
        try:
            resp = httpx.get(
                f"{PlexLookupRepository.PROXY_URL}/customers",
                headers=PlexLookupRepository.HEADERS,
                params=params,
                timeout=PlexLookupRepository.TIMEOUT,
            )
            resp.raise_for_status()
            data = resp.json().get("data", [])
            cache.set(cache_key, data, 3600)  # 1 hora
            return data
        except Exception as e:
            raise Exception(f"Plex Customer lookup failed: {str(e)}")

    @staticmethod
    def get_customer_locations(customer_no: str) -> list[dict]:
        """
        Obtener locations de un customer.
        
        ENDPOINT PENDIENTE: GET /customer-locations/{customer_no}
        Response: [{"location": "Plant 1", ...}, ...]
        """
        cache_key = f"plex:customer_locations:{customer_no}"
        cached = cache.get(cache_key)
        if cached:
            return cached

        try:
            resp = httpx.get(
                f"{PlexLookupRepository.PROXY_URL}/customer-locations/{customer_no}",
                headers=PlexLookupRepository.HEADERS,
                timeout=PlexLookupRepository.TIMEOUT,
            )
            resp.raise_for_status()
            data = resp.json().get("data", [])
            cache.set(cache_key, data, 3600)
            return data
        except Exception as e:
            raise Exception(f"Plex Customer Location lookup failed: {str(e)}")

    @staticmethod
    def get_customer_parts(customer_no: str) -> list[dict]:
        """
        Obtener part numbers del customer.
        
        ENDPOINT PENDIENTE: GET /customer-parts/{customer_no}
        """
        cache_key = f"plex:customer_parts:{customer_no}"
        cached = cache.get(cache_key)
        if cached:
            return cached

        try:
            resp = httpx.get(
                f"{PlexLookupRepository.PROXY_URL}/customer-parts/{customer_no}",
                headers=PlexLookupRepository.HEADERS,
                timeout=PlexLookupRepository.TIMEOUT,
            )
            resp.raise_for_status()
            data = resp.json().get("data", [])
            cache.set(cache_key, data, 3600)
            return data
        except Exception as e:
            raise Exception(f"Plex Customer Part lookup failed: {str(e)}")

    @staticmethod
    def get_suppliers(search: str = None) -> list[dict]:
        """
        Obtener lista de suppliers desde Plex.
        
        ENDPOINT PENDIENTE: GET /suppliers?search=xxx
        """
        cache_key = f"plex:suppliers:{search or 'all'}"
        cached = cache.get(cache_key)
        if cached:
            return cached

        params = {"search": search} if search else {}

        try:
            resp = httpx.get(
                f"{PlexLookupRepository.PROXY_URL}/suppliers",
                headers=PlexLookupRepository.HEADERS,
                params=params,
                timeout=PlexLookupRepository.TIMEOUT,
            )
            resp.raise_for_status()
            data = resp.json().get("data", [])
            cache.set(cache_key, data, 3600)
            return data
        except Exception as e:
            raise Exception(f"Plex Supplier lookup failed: {str(e)}")

    @staticmethod
    def get_departments() -> list[dict]:
        """
        Obtener lista de departments desde Plex.
        
        ENDPOINT PENDIENTE: GET /departments
        Response: [{"code": "ASSY", "name": "Assembly"}, ...]
        """
        cache_key = "plex:departments"
        cached = cache.get(cache_key)
        if cached:
            return cached

        try:
            resp = httpx.get(
                f"{PlexLookupRepository.PROXY_URL}/departments",
                headers=PlexLookupRepository.HEADERS,
                timeout=PlexLookupRepository.TIMEOUT,
            )
            resp.raise_for_status()
            data = resp.json().get("data", [])
            cache.set(cache_key, data, 3600)
            return data
        except Exception as e:
            raise Exception(f"Plex Department lookup failed: {str(e)}")

    @staticmethod
    def get_workcenters() -> list[dict]:
        """
        Obtener lista de workcenters desde Plex.
        
        ENDPOINT PENDIENTE: GET /workcenters
        Response: [{"code": "WC01", "name": "Assembly Line 1"}, ...]
        """
        cache_key = "plex:workcenters"
        cached = cache.get(cache_key)
        if cached:
            return cached

        try:
            resp = httpx.get(
                f"{PlexLookupRepository.PROXY_URL}/workcenters",
                headers=PlexLookupRepository.HEADERS,
                timeout=PlexLookupRepository.TIMEOUT,
            )
            resp.raise_for_status()
            data = resp.json().get("data", [])
            cache.set(cache_key, data, 3600)
            return data
        except Exception as e:
            raise Exception(f"Plex Workcenter lookup failed: {str(e)}")

    @staticmethod
    def get_parts(search: str = None) -> list[dict]:
        """
        Obtener lista de part numbers desde Plex.
        
        ENDPOINT PENDIENTE: GET /parts?search=xxx
        Response: [{"part_no": "12345", "name": "Part Name"}, ...]
        """
        cache_key = f"plex:parts:{search or 'all'}"
        cached = cache.get(cache_key)
        if cached:
            return cached

        params = {"search": search} if search else {}

        try:
            resp = httpx.get(
                f"{PlexLookupRepository.PROXY_URL}/parts",
                headers=PlexLookupRepository.HEADERS,
                params=params,
                timeout=PlexLookupRepository.TIMEOUT,
            )
            resp.raise_for_status()
            data = resp.json().get("data", [])
            cache.set(cache_key, data, 3600)
            return data
        except Exception as e:
            raise Exception(f"Plex Part lookup failed: {str(e)}")