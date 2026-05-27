"""
HTTP client to the qwall-proxy for SSI modules (chairs + attendance).
All SQL runs inside qwall-proxy (Windows machine with Integrated Security).
"""

import os
import requests

PROXY_URL   = os.getenv("QWALL_PROXY_URL",   "http://host.docker.internal:8002")
PROXY_TOKEN = os.getenv("QWALL_PROXY_TOKEN", "")
HEADERS     = {"Authorization": f"Bearer {PROXY_TOKEN}"}
TIMEOUT     = 30


def proxy_post(path: str, body: dict) -> dict:
    resp = requests.post(f"{PROXY_URL}{path}", json=body, headers=HEADERS, timeout=TIMEOUT)
    resp.raise_for_status()
    return resp.json()


def proxy_get(path: str, params: dict | None = None) -> dict:
    resp = requests.get(f"{PROXY_URL}{path}", params=params, headers=HEADERS, timeout=TIMEOUT)
    resp.raise_for_status()
    return resp.json()
