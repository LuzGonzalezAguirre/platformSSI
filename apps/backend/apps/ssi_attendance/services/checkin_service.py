from apps.ssi_common.db import proxy_post, proxy_get


class CheckInService:

    @staticmethod
    def register_check_in(barcode_id: str) -> dict:
        return proxy_post("/attendance/check-in", {"barcode_id": barcode_id})

    @staticmethod
    def register_check_out(barcode_id: str) -> dict:
        return proxy_post("/attendance/check-out", {"barcode_id": barcode_id})

    @staticmethod
    def register_overtime(employee_id: int, overtime_date: str) -> dict:
        return proxy_post("/attendance/overtime", {
            "employee_id": employee_id,
            "overtime_date": overtime_date,
        })

    @staticmethod
    def get_today_status(barcode_id: str) -> dict:
        return proxy_get("/attendance/today-status", {"barcode_id": barcode_id})
