from datetime import date
from apps.ssi_common.db import proxy_post, proxy_get


class AttendanceService:

    @staticmethod
    def get_records(
        start_date: date, end_date: date,
        turno: str | None, department: str | None,
        employee_id: int | None,
        page: int, page_size: int,
    ) -> dict:
        result = proxy_post("/attendance/records", {
            "start_date":  str(start_date),
            "end_date":    str(end_date),
            "turno":       turno,
            "department":  department,
            "employee_id": employee_id,
        })
        rows  = result.get("data", [])
        total = len(rows)
        offset = (page - 1) * page_size
        return {
            "total":     total,
            "page":      page,
            "page_size": page_size,
            "pages":     max(1, -(-total // page_size)),
            "results":   rows[offset: offset + page_size],
        }

    @staticmethod
    def get_kpis(start_date: date, end_date: date, turno: str | None, department: str | None) -> dict:
        return proxy_post("/attendance/kpis", {
            "start_date": str(start_date), "end_date": str(end_date),
            "turno": turno, "department": department,
        })

    @staticmethod
    def get_employees(department: str | None = None) -> list[dict]:
        result = proxy_get("/attendance/employees", {"department": department} if department else None)
        return result.get("data", [])
