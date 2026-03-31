from datetime import date
from rest_framework.exceptions import NotFound, ValidationError
from apps.production.repositories.targets_repository import TargetsRepository

DAY_NAMES = ["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"]


class TargetsService:

    @staticmethod
    def list_business_units():
        return TargetsRepository.get_business_units()

    @staticmethod
    def get_weekly_target(week_date: date, bu_code: str) -> dict:
        bu = TargetsRepository.get_business_unit(bu_code)
        if not bu:
            raise NotFound(f"Business unit '{bu_code}' not found.")
        obj = TargetsRepository.get_weekly_target(week_date, bu_code)
        if obj:
            return obj
        return None

    @staticmethod
    def save_weekly_target(week_date: date, bu_code: str, data: dict, user):
        bu = TargetsRepository.get_business_unit(bu_code)
        if not bu:
            raise NotFound(f"Business unit '{bu_code}' not found.")
        general = data.get("general_target", 0)
        payload = {"general_target": general}
        for day in DAY_NAMES:
            payload[day] = data.get(day, general)
        return TargetsRepository.upsert_weekly_target(week_date, bu, payload, user)

    @staticmethod
    def get_weekly_wip(week_date: date, bu_code: str):
        bu = TargetsRepository.get_business_unit(bu_code)
        if not bu:
            raise NotFound(f"Business unit '{bu_code}' not found.")
        return TargetsRepository.get_weekly_wip(week_date, bu_code)

    @staticmethod
    def save_weekly_wip(week_date: date, bu_code: str, data: dict, user):
        bu = TargetsRepository.get_business_unit(bu_code)
        if not bu:
            raise NotFound(f"Business unit '{bu_code}' not found.")
        general_actual = data.get("general_actual", 0)
        general_goal   = data.get("general_goal", 0)
        payload = {"general_actual": general_actual, "general_goal": general_goal}
        for day in DAY_NAMES:
            payload[f"{day}_actual"] = data.get(f"{day}_actual", general_actual)
            payload[f"{day}_goal"]   = data.get(f"{day}_goal",   general_goal)
        return TargetsRepository.upsert_weekly_wip(week_date, bu, payload, user)