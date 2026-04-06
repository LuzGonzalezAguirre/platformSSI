from datetime import date, timedelta
from django.db.models import QuerySet
from apps.production.models import BusinessUnit, WeeklyTarget, WeeklyWIP, OEERecord


def _get_week_start(d: date) -> date:
    return d - timedelta(days=d.weekday())


class TargetsRepository:

    @staticmethod
    def get_business_units(active_only: bool = True) -> QuerySet:
        qs = BusinessUnit.objects.all()
        if active_only:
            qs = qs.filter(is_active=True)
        return qs

    @staticmethod
    def get_business_unit(code: str) -> BusinessUnit | None:
        try:
            return BusinessUnit.objects.get(code=code.lower())
        except BusinessUnit.DoesNotExist:
            return None

    @staticmethod
    def get_weekly_target(week_date: date, bu_code: str) -> WeeklyTarget | None:
        week_start = _get_week_start(week_date)
        try:
            return WeeklyTarget.objects.select_related("business_unit").get(
                week_start=week_start,
                business_unit__code=bu_code.lower(),
            )
        except WeeklyTarget.DoesNotExist:
            return None

    @staticmethod
    def upsert_weekly_target(week_date: date, bu: BusinessUnit, data: dict, user) -> WeeklyTarget:
        week_start = _get_week_start(week_date)
        obj, _ = WeeklyTarget.objects.update_or_create(
            week_start=week_start,
            business_unit=bu,
            defaults={**data, "updated_by": user},
        )
        return obj

    @staticmethod
    def get_weekly_wip(week_date: date, bu_code: str) -> WeeklyWIP | None:
        week_start = _get_week_start(week_date)
        try:
            return WeeklyWIP.objects.select_related("business_unit").get(
                week_start=week_start,
                business_unit__code=bu_code.lower(),
            )
        except WeeklyWIP.DoesNotExist:
            return None

    @staticmethod
    def upsert_weekly_wip(week_date: date, bu: BusinessUnit, data: dict, user) -> WeeklyWIP:
        week_start = _get_week_start(week_date)
        obj, _ = WeeklyWIP.objects.update_or_create(
            week_start=week_start,
            business_unit=bu,
            defaults={**data, "updated_by": user},
        )
        return obj
    
    @staticmethod
    def get_oee(date: "date") -> "OEERecord | None":
        from apps.production.models import OEERecord
        try:
            return OEERecord.objects.get(date=date)
        except OEERecord.DoesNotExist:
            return None

    @staticmethod
    def upsert_oee(date: "date", availability: float, performance: float,
                   quality: float, oee: float, user) -> "OEERecord":
        from apps.production.models import OEERecord
        obj, _ = OEERecord.objects.update_or_create(
            date=date,
            defaults={
                "availability_pct": availability,
                "performance_pct":  performance,
                "quality_pct":      quality,
                "oee_pct":          oee,
                "recorded_by":      user,
            },
        )
        return obj