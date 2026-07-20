from django.core.cache import cache
from rest_framework.exceptions import PermissionDenied
from apps.maintenance.repositories.dashboard_targets_repository import DashboardTargetsRepository

CACHE_KEY = "maint:dashboard_targets"
CACHE_TTL = 1800  # 30 min — estos valores cambian con poca frecuencia

WRITE_ROLES = {"admin", "plant_manager", "maintenance_engineer"}


def _check_write(user):
    user_roles = set(
        user.user_roles.select_related("role").values_list("role__slug", flat=True)
    )
    if not user_roles.intersection(WRITE_ROLES):
        raise PermissionDenied("No tienes permisos para modificar los targets del dashboard.")


class DashboardTargetsService:

    @staticmethod
    def get_targets():
        cached = cache.get(CACHE_KEY)
        if cached is not None:
            return cached
        targets = list(DashboardTargetsRepository.list_all())
        cache.set(CACHE_KEY, targets, CACHE_TTL)
        return targets

    @staticmethod
    def update_targets(items: list[dict], user):
        _check_write(user)
        result = DashboardTargetsRepository.upsert_many(items, user)
        cache.delete(CACHE_KEY)
        return result
