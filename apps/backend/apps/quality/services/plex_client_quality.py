from apps.warehouse.services.plex_client import PlexClient

class QualityPlexClient(PlexClient):
    def get_scrap_detail(
        self,
        start_date: str,
        end_date: str,
        use_shift: bool = True,
    ) -> dict:
        url      = f"{self.base_url}/scrap-detail"
        import httpx
        response = httpx.post(
            url,
            json={"start_date": start_date, "end_date": end_date, "use_shift": use_shift},
            headers=self._headers(),
            timeout=self.timeout,
        )
        response.raise_for_status()
        return response.json()