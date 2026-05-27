from datetime import date
from apps.ssi_common.db import proxy_post


class KpiService:

    @staticmethod
    def get_kpis(start_date: date, end_date: date, turno: str | None, department: str | None) -> dict:
        return proxy_post("/chairs/kpis", {
            "start_date": str(start_date),
            "end_date":   str(end_date),
            "turno":      turno,
            "department": department,
        })
