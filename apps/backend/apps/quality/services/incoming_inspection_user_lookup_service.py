# apps/quality/services/incoming_inspection_user_lookup_service.py
"""
Resuelve Plexus_User_No -> nombre completo, vía plex-proxy, con cache Redis
de 24h por usuario (los nombres casi nunca cambian).

Excepción deliberada a la regla de "solo tasks.py/incoming_inspection_plex_
repository.py llaman a plex-proxy para este módulo": ese patrón existe para
proteger contra alto volumen (Snapshot/History, miles de filas). Este lookup
es de bajo volumen y fuertemente cacheable, así que sigue el mismo patrón de
llamada síncrona request-time que ya usan qwall_settings_views.py y
scan_rules_views.py para sus propios proxies.
"""
import os
import requests
from django.core.cache import cache

PROXY_URL = os.getenv("PLEX_PROXY_URL", "http://host.docker.internal:8001")
PROXY_SECRET = os.getenv("PLEX_PROXY_SECRET", "")
HEADERS = {"Authorization": f"Bearer {PROXY_SECRET}"}
TIMEOUT = 30
CACHE_TTL = 60 * 60 * 24  # 24h
CACHE_KEY_PREFIX = "incoming_inspection:user_lookup:"


def resolve_user_names(user_nos: list[int]) -> dict[int, str]:
    result: dict[int, str] = {}
    missing: list[int] = []

    for no in set(user_nos):
        cached = cache.get(f"{CACHE_KEY_PREFIX}{no}")
        if cached is not None:
            result[no] = cached
        else:
            missing.append(no)

    if missing:
        try:
            resp = requests.post(
                f"{PROXY_URL}/user-lookup",
                json={"user_nos": missing},
                headers=HEADERS,
                timeout=TIMEOUT,
            )
            resp.raise_for_status()
            rows = resp.json().get("data", [])
            for row in rows:
                no = row["Plexus_User_No"]
                name = f"{(row.get('First_Name') or '').strip()} {(row.get('Last_Name') or '').strip()}".strip()
                result[no] = name or str(no)
                cache.set(f"{CACHE_KEY_PREFIX}{no}", result[no], CACHE_TTL)
        except Exception:
            # Nunca tumbar el dashboard por un fallo de lookup secundario --
            # degrada a mostrar el número crudo en vez de propagar el error.
            for no in missing:
                result.setdefault(no, str(no))

    return result