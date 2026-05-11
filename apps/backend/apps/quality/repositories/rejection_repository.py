# apps/quality/repositories/rejection_repository.py
 
import httpx 
from django.conf import settings


PROXY_URL    = settings.QWALL_PROXY_URL   # http://host.docker.internal:8002
PROXY_SECRET = settings.QWALL_PROXY_TOKEN

class RejectionRepository:

    _headers = {"Authorization": f"Bearer {PROXY_SECRET}"}

    def get_rejection_report(self, start: str, end: str, bu_id: int | None) -> list[dict]:
        payload = {"start_date": start, "end_date": end, "bu_id": bu_id}
        resp = httpx.post(
            f"{PROXY_URL}/rejection-report",
            json=payload,
            headers=self._headers,
            timeout=30,
        )
        resp.raise_for_status()
        return resp.json().get("data", [])

    def get_rejection_photo(self, inspection_id: int) -> dict:
        resp = httpx.get(
            f"{PROXY_URL}/rejection-photo/{inspection_id}",
            headers=self._headers,
            timeout=15,
        )
        resp.raise_for_status()
        return resp.json()