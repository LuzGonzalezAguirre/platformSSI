from django.utils import timezone
from apps.maintenance.models import CorrectiveAction, CorrectiveActionComment, CorrectiveActionHistory


class CorrectiveActionRepository:

    @staticmethod
    def list_all(filters: dict):
        qs = CorrectiveAction.objects.select_related(
            "assigned_to", "created_by", "closed_by"
        ).all()
        if filters.get("status"):
            qs = qs.filter(status=filters["status"])
        if filters.get("priority"):
            qs = qs.filter(priority=filters["priority"])
        if filters.get("equipment_id"):
            qs = qs.filter(equipment_id=filters["equipment_id"])
        if filters.get("assigned_to"):
            qs = qs.filter(assigned_to_id=filters["assigned_to"])
        return qs

    @staticmethod
    def get(pk: int):
        try:
            return CorrectiveAction.objects.select_related(
                "assigned_to", "created_by", "closed_by"
            ).prefetch_related("comments__created_by", "history__changed_by").get(pk=pk)
        except CorrectiveAction.DoesNotExist:
            return None

    @staticmethod
    def create(data: dict, user) -> CorrectiveAction:
        data["created_by"] = user
        data["status"]     = "open"
        obj = CorrectiveAction.objects.create(**data)
        CorrectiveActionHistory.objects.create(
            action=obj, field="status",
            old_value="", new_value="open", changed_by=user,
        )
        return obj

    @staticmethod
    def update(instance: CorrectiveAction, data: dict, user) -> CorrectiveAction:
        TRACKED_FIELDS = {"status", "assigned_to", "priority", "due_date"}

        for field, new_val in data.items():
            old_val = getattr(instance, field)

            if field in TRACKED_FIELDS:
                old_str = str(old_val.id if hasattr(old_val, 'id') else old_val or "")
                new_str = str(new_val.id if hasattr(new_val, 'id') else new_val or "")
                if old_str != new_str:
                    CorrectiveActionHistory.objects.create(
                        action=instance, field=field,
                        old_value=old_str, new_value=new_str, changed_by=user,
                    )

            setattr(instance, field, new_val)

        # Auto-fill cierre
        if instance.status == "closed" and not instance.closed_at:
            instance.closed_by = user
            instance.closed_at = timezone.now()

        instance.save()
        return instance

    @staticmethod
    def delete(instance: CorrectiveAction) -> None:
        instance.delete()

    @staticmethod
    def add_comment(action: CorrectiveAction, text: str, user) -> CorrectiveActionComment:
        return CorrectiveActionComment.objects.create(
            action=action, text=text, created_by=user,
        )