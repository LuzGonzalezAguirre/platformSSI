from datetime import date
from django.db.models import QuerySet
from apps.production.models import PlantEmployee, AttendanceRecord


class AssistanceRepository:

    @staticmethod
    def list_employees(turno: str | None = None, active_only: bool = True) -> QuerySet:
        qs = PlantEmployee.objects.select_related("user").all()
        if active_only:
            qs = qs.filter(is_active=True)
        if turno:
            qs = qs.filter(turno=turno)
        return qs

    @staticmethod
    def get_employee(pk: int) -> PlantEmployee | None:
        try:
            return PlantEmployee.objects.get(pk=pk)
        except PlantEmployee.DoesNotExist:
            return None

    @staticmethod
    def create_employee(data: dict) -> PlantEmployee:
        return PlantEmployee.objects.create(**data)

    @staticmethod
    def update_employee(employee: PlantEmployee, data: dict) -> PlantEmployee:
        for field, value in data.items():
            setattr(employee, field, value)
        employee.save()
        return employee

    @staticmethod
    def deactivate_employee(employee: PlantEmployee) -> PlantEmployee:
        employee.is_active = False
        employee.save(update_fields=["is_active"])
        return employee

    @staticmethod
    def get_attendance_for_date(attendance_date: date, turno: str | None = None) -> QuerySet:
        qs = AttendanceRecord.objects.select_related("employee").filter(date=attendance_date)
        if turno:
            qs = qs.filter(employee__turno=turno)
        return qs

    @staticmethod
    def bulk_upsert_attendance(records: list[dict], user) -> int:
        count = 0
        for rec in records:
            employee_id = rec.pop("employee_id")
            rec_date    = rec.pop("date")
            AttendanceRecord.objects.update_or_create(
                employee_id=employee_id,
                date=rec_date,
                defaults={**rec, "recorded_by": user},
            )
            count += 1
        return count