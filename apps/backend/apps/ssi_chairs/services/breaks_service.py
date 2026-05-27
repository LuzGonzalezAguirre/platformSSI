from datetime import date
from apps.ssi_common.db import proxy_post


class BreaksService:

    @staticmethod
    def get_breaks(
        start_date: date, end_date: date, turno: str | None, department: str | None,
        search: str | None, page: int, page_size: int, order_by: str, order_dir: str,
    ) -> dict:
        return proxy_post("/chairs/breaks", {
            "start_date": str(start_date), "end_date": str(end_date),
            "turno": turno, "department": department,
            "search": search, "page": page, "page_size": page_size,
            "order_by": order_by, "order_dir": order_dir,
        })

    @staticmethod
    def get_daily_chart(start_date: date, end_date: date, turno: str | None, department: str | None) -> list[dict]:
        result = proxy_post("/chairs/daily-chart", {
            "start_date": str(start_date), "end_date": str(end_date),
            "turno": turno, "department": department,
        })
        return result.get("data", [])

    @staticmethod
    def get_turno_distribution(start_date: date, end_date: date) -> list[dict]:
        result = proxy_post("/chairs/turno-chart", {
            "start_date": str(start_date), "end_date": str(end_date),
        })
        return result.get("data", [])
