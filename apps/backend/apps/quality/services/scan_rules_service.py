import logging
import os

import requests
from rest_framework.exceptions import ValidationError

log = logging.getLogger(__name__)

PROXY_URL   = os.getenv("QWALL_PROXY_URL",   "http://host.docker.internal:8002")
PROXY_TOKEN = os.getenv("QWALL_PROXY_TOKEN", "")
_HEADERS    = {"Authorization": f"Bearer {PROXY_TOKEN}"}
_TIMEOUT    = 15


def _get(path: str, params: dict = None) -> dict:
    resp = requests.get(
        f"{PROXY_URL}{path}", params=params, headers=_HEADERS, timeout=_TIMEOUT
    )
    if resp.status_code == 404:
        return None
    resp.raise_for_status()
    return resp.json()


def _post(path: str, body: dict) -> dict:
    resp = requests.post(
        f"{PROXY_URL}{path}", json=body, headers=_HEADERS, timeout=_TIMEOUT
    )
    if resp.status_code == 400:
        raise ValidationError(resp.json().get("detail", resp.text))
    resp.raise_for_status()
    return resp.json()


def _patch(path: str, body: dict) -> dict:
    resp = requests.patch(
        f"{PROXY_URL}{path}", json=body, headers=_HEADERS, timeout=_TIMEOUT
    )
    if resp.status_code == 404:
        return None
    if resp.status_code == 400:
        raise ValidationError(resp.json().get("detail", resp.text))
    resp.raise_for_status()
    return resp.json()


def _delete(path: str) -> bool:
    resp = requests.delete(
        f"{PROXY_URL}{path}", headers=_HEADERS, timeout=_TIMEOUT
    )
    if resp.status_code == 404:
        return False
    resp.raise_for_status()
    return True


def _fetch_pn_details(pn_id: int) -> dict:
    """Obtiene ssi_pn, bu_id, bu_name desde SQL Server via proxy."""
    result = _get("/settings/part-numbers-lookup")
    if result is None:
        raise ValidationError("qwall-proxy no disponible para verificar el PN.")
    for item in result.get("data", []):
        if item.get("pn_id") == pn_id:
            return item
    raise ValidationError(f"pn_id={pn_id} no existe en ssi_PartNumbers.")


class ScanRulesService:

    @staticmethod
    def get_all_rules(bu_id=None, is_active=None):
        params = {}
        if bu_id is not None:
            params["bu_id"] = bu_id
        if is_active is not None:
            params["is_active"] = str(is_active).lower()
        result = _get("/scan-rules/", params=params)
        return result.get("data", []) if result else []

    @staticmethod
    def get_rule(rule_id: int):
        return _get(f"/scan-rules/{rule_id}")

    @staticmethod
    def get_rule_by_pn(pn_id: int):
        result = _get("/scan-rules/", params={"pn_id": pn_id})
        if not result:
            return None
        data = result.get("data", [])
        return data[0] if data else None

    @staticmethod
    def create_rule(data: dict, user) -> dict:
        pn_id   = data["pn_id"]
        pn_info = _fetch_pn_details(pn_id)

        payload = {
            "pn_id":          pn_id,
            "ssi_pn":         pn_info["ssiPN"],
            "bu_id":          pn_info["bu_id"],
            "bu_name":        pn_info.get("bu_name", ""),
            "scan_count":     data.get("scan_count", 1),
            "requires_match": data.get("requires_match", False),
            "notes":          data.get("notes", ""),
            "is_active":      data.get("is_active", True),
            "created_by_id":  user.pk,
            "scan_fields":    [dict(f) for f in data.get("scan_fields", [])],
        }
        return _post("/scan-rules/", payload)

    @staticmethod
    def update_rule(rule_id: int, data: dict, user) -> dict | None:
        payload = {"updated_by_id": user.pk}

        new_pn_id = data.get("pn_id")
        if new_pn_id:
            pn_info = _fetch_pn_details(new_pn_id)
            payload.update({
                "pn_id":   new_pn_id,
                "ssi_pn":  pn_info["ssiPN"],
                "bu_id":   pn_info["bu_id"],
                "bu_name": pn_info.get("bu_name", ""),
            })

        for field in ("scan_count", "requires_match", "notes", "is_active"):
            if field in data:
                payload[field] = data[field]

        if "scan_fields" in data:
            payload["scan_fields"] = [dict(f) for f in data["scan_fields"]]

        return _patch(f"/scan-rules/{rule_id}", payload)

    @staticmethod
    def toggle_active(rule_id: int, user) -> dict | None:
        result = _patch(
            f"/scan-rules/{rule_id}/toggle",
            {"updated_by_id": user.pk},
        )
        return result

    @staticmethod
    def delete_rule(rule_id: int) -> bool:
        return _delete(f"/scan-rules/{rule_id}")
