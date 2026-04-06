from datetime import date
from rest_framework.exceptions import NotFound
from apps.production.repositories.assistance_repository import AssistanceRepository


class AssistanceService:

    @staticmethod
    def list_employees(turno: str | None = None, include_inactive: bool = False):
        return AssistanceRepository.list_employees(turno=turno, active_only=not include_inactive)

    @staticmethod
    def create_employee(data: dict):
        return AssistanceRepository.create_employee(data)

    @staticmethod
    def update_employee(pk: int, data: dict):
        employee = AssistanceRepository.get_employee(pk)
        if not employee:
            raise NotFound(f"Employee {pk} not found.")
        return AssistanceRepository.update_employee(employee, data)

    @staticmethod
    def deactivate_employee(pk: int):
        employee = AssistanceRepository.get_employee(pk)
        if not employee:
            raise NotFound(f"Employee {pk} not found.")
        return AssistanceRepository.deactivate_employee(employee)

    @staticmethod
    def get_attendance(attendance_date: date, turno: str | None = None):
        employees = AssistanceRepository.list_employees(turno=turno, active_only=True)
        existing  = {
            r.employee_id: r
            for r in AssistanceRepository.get_attendance_for_date(attendance_date, turno)
        }
        result = []
        for emp in employees:
            if emp.id in existing:
                result.append(existing[emp.id])
            else:
                result.append({
                    "employee": emp,
                    "date":     attendance_date,
                    "status":   "present",
                    "shift":    "full",
                    "hours":    12.0,
                    "_unsaved": True,
                })
        return result

    @staticmethod
    def bulk_save_attendance(records: list[dict], user) -> int:
        return AssistanceRepository.bulk_upsert_attendance(records, user)
    
    @staticmethod
    def get_earned_hours(attendance_date: date):
        return AssistanceRepository.get_earned_hours(attendance_date)
    
    @staticmethod
    def save_earned_hours(attendance_date: date, earned_hours: float, notes: str, user):
        return AssistanceRepository.upsert_earned_hours(attendance_date, earned_hours, notes, user)

    @staticmethod
    def delete_earned_hours(attendance_date: date) -> bool:
        return AssistanceRepository.delete_earned_hours(attendance_date)

    @staticmethod
    def get_earned_hours_range(start: date, end: date) -> list:
        return AssistanceRepository.get_earned_hours_range(start, end)