"""Proxy client for the photo evidence of one flagged inspection."""
import httpx
from django.conf import settings


class FlagPhotoRepository:
    @staticmethod
    def get_photos(flag_id: int) -> dict:
        response = httpx.get(
            f"{settings.QWALL_PROXY_URL}/piece-flags/{flag_id}/photos",
            headers={"Authorization": f"Bearer {settings.QWALL_PROXY_TOKEN}"},
            timeout=45,
        )
        response.raise_for_status()
        return response.json()
