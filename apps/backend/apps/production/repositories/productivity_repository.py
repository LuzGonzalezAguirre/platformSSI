from datetime import date

from django.db.models import Count, Q, Sum

from apps.production.models import CcsAttendanceRecord


class ProductivityRepository:

    @staticmethod
    def get_attendance_aggregate(target_date: date, turno: str | None = None) -> dict:
        qs = CcsAttendanceRecord.objects.filter(date=target_date)
        if turno:
            qs = qs.filter(turno=turno)
        return qs.aggregate(
            paid_hours=Sum("hours"),
            headcount_recorded=Count("id"),
            headcount_present=Count("id", filter=~Q(status=CcsAttendanceRecord.Status.ABSENT)),
            headcount_absent=Count("id", filter=Q(status=CcsAttendanceRecord.Status.ABSENT)),
        )