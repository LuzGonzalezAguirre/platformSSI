from apps.maintenance.models import MaintenanceDashboardTarget


class DashboardTargetsRepository:

    @staticmethod
    def list_all():
        return MaintenanceDashboardTarget.objects.all()

    @staticmethod
    def upsert_many(items: list[dict], user) -> list[MaintenanceDashboardTarget]:
        result = []
        for item in items:
            obj, _ = MaintenanceDashboardTarget.objects.update_or_create(
                metric_key=item["metric_key"],
                defaults={"target_value": item["target_value"], "updated_by": user},
            )
            result.append(obj)
        return result
