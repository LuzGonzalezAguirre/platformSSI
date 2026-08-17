from datetime import date

from django.db.models import Count, Q, Sum

from apps.production.models import AttendanceRecord


class ProductivityRepository:

    @staticmethod
    def get_attendance_aggregate(target_date: date, turno: str | None = None) -> dict:
        qs = AttendanceRecord.objects.filter(date=target_date)
        if turno:
            qs = qs.filter(employee__turno=turno)

        return qs.aggregate(
            paid_hours=Sum("hours"),
            headcount_recorded=Count("id"),
            headcount_present=Count(
                "id", filter=Q(status=AttendanceRecord.Status.PRESENT)
            ),
            headcount_absent=Count(
                "id", filter=Q(status=AttendanceRecord.Status.ABSENT)
            ),
        )