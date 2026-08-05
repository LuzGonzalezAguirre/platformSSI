from datetime import date
from decimal import ROUND_HALF_UP, Decimal

from apps.production.repositories.assistance_repository import AssistanceRepository
from apps.production.repositories.productivity_repository import ProductivityRepository


class ProductivityService:

    @staticmethod
    def get_daily_productivity(target_date: date, turno: str | None = None) -> dict:
        agg = ProductivityRepository.get_attendance_aggregate(target_date, turno)

        headcount_recorded = agg["headcount_recorded"] or 0
        attendance_saved   = headcount_recorded > 0
        paid_hours         = Decimal(agg["paid_hours"] or 0)

        earned_record = AssistanceRepository.get_earned_hours(target_date)
        earned_hours  = Decimal(earned_record.earned_hours) if earned_record else None

        productivity_pct = None
        if attendance_saved and paid_hours > 0 and earned_hours is not None:
            productivity_pct = (earned_hours / paid_hours * 100).quantize(
                Decimal("0.1"), rounding=ROUND_HALF_UP
            )

        return {
            "date":               target_date,
            "turno":              turno,
            "attendance_saved":   attendance_saved,
            "paid_hours":         paid_hours if attendance_saved else None,
            "earned_hours":       earned_hours,
            "productivity_pct":   productivity_pct,
            "headcount_recorded": headcount_recorded,
            "headcount_present":  agg["headcount_present"] or 0,
            "headcount_absent":   agg["headcount_absent"] or 0,
            "notes":              earned_record.notes if earned_record else "",
            "recorded_at":        earned_record.recorded_at if earned_record else None,
        }