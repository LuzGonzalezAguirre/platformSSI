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
    def get_cogp_cost_model(self) -> dict:
        return self._get("cogp/cost-model")

    def get_cogp_customer_part_mapping(self) -> list:
        return self._get("cogp/customer-part-mapping").get("data", [])

    def get_cogp_scrap_by_date(self, report_date: str) -> list:
        return self._post("cogp/scrap-by-date", {"report_date": report_date})

    def get_cogp_production_by_date(self, report_date: str, cost_model_key: int) -> list:
        return self._post("cogp/production-by-date", {
            "report_date":    report_date,
            "cost_model_key": cost_model_key,
        })
    def get_cogp_scrap_range(self, start_date: str, end_date: str) -> list:
        return self._post("cogp/scrap-range", {
            "start_date": start_date, "end_date": end_date,
        })

    def get_cogp_production_range(self, start_date: str, end_date: str, cost_model_key: int) -> list:
        return self._post("cogp/production-range", {
            "start_date": start_date, "end_date": end_date, "cost_model_key": cost_model_key,
        })