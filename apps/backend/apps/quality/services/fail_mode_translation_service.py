# apps/backend/apps/quality/services/fail_mode_translation_service.py
from ..models import FailModeTranslation


class FailModeTranslationService:

    @staticmethod
    def get_translations_map(locale: str) -> dict[str, str]:
        """code -> translated name, para el locale dado."""
        return dict(
            FailModeTranslation.objects.filter(locale=locale).values_list("fail_mode_code", "name")
        )

    @staticmethod
    def get_missing(codes: list[str], locale: str) -> list[str]:
        translated = set(
            FailModeTranslation.objects
            .filter(locale=locale, fail_mode_code__in=codes)
            .values_list("fail_mode_code", flat=True)
        )
        return [c for c in codes if c not in translated]

    @staticmethod
    def upsert(fail_mode_code: str, locale: str, name: str) -> FailModeTranslation:
        obj, _ = FailModeTranslation.objects.update_or_create(
            fail_mode_code=fail_mode_code, locale=locale, defaults={"name": name},
        )
        return obj
