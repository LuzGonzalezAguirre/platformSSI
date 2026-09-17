from django.utils import timezone

from .models import Notification


class NotificationService:
    ACTION_CONFIG = {
        "ContainmentAction": ("D3", "Containment Action"),
        "CorrectiveAction": ("D5", "Corrective Action"),
        "VerificationAction": ("D6", "Verification Action"),
        "PreventionAction": ("D7", "Prevention Action"),
    }

    @staticmethod
    def _problem_label(problem):
        return problem.problem_number or f"Problem #{problem.pk}"

    @classmethod
    def notify_team_members(cls, problem, recipient_ids, actor=None):
        label = cls._problem_label(problem)
        for recipient_id in recipient_ids:
            if actor and recipient_id == actor.id:
                continue
            event_key = f"problem-team:{problem.pk}:{recipient_id}"
            Notification.objects.update_or_create(
                event_key=event_key,
                defaults={
                    "recipient_id": recipient_id,
                    "actor": actor,
                    "notification_type": "problem_team_assigned",
                    "title": "Problem Control assignment",
                    "message": f"You were added to {label} — {problem.brief_description}",
                    "module": "problem_control",
                    "entity_type": "problem",
                    "entity_id": problem.pk,
                    "action_url": f"/quality/problems/{problem.pk}/edit?step=2",
                    "metadata": {"problem_number": label, "step": "D2"},
                    "is_task": False,
                    "read_at": None,
                    "resolved_at": None,
                },
            )

    @classmethod
    def sync_action_assignment(cls, action, previous_responsible_id=None, actor=None):
        model_name = action.__class__.__name__
        config = cls.ACTION_CONFIG.get(model_name)
        if not config:
            return

        step, action_label = config
        key_prefix = f"problem-action:{model_name}:{action.pk}:"
        if previous_responsible_id and previous_responsible_id != action.responsible_id:
            Notification.objects.filter(
                event_key=f"{key_prefix}{previous_responsible_id}",
                resolved_at__isnull=True,
            ).update(resolved_at=timezone.now())

        if not action.responsible_id:
            return

        problem = action.problem
        problem_label = cls._problem_label(problem)
        is_complete = bool(action.completion_date)
        notification, created = Notification.objects.update_or_create(
            event_key=f"{key_prefix}{action.responsible_id}",
            defaults={
                "recipient_id": action.responsible_id,
                "actor": actor,
                "notification_type": "problem_action_assigned",
                "title": f"{step} action assigned",
                "message": f"{problem_label} · {action_label}: {action.action}",
                "module": "problem_control",
                "entity_type": model_name,
                "entity_id": action.pk,
                "action_url": f"/quality/problems/{problem.pk}/edit?step={step.removeprefix('D')}",
                "metadata": {
                    "problem_id": problem.pk,
                    "problem_number": problem_label,
                    "step": step,
                    "due_date": action.due_date.isoformat() if action.due_date else None,
                },
                "is_task": True,
                "resolved_at": timezone.now() if is_complete else None,
            },
        )
        if not created and not is_complete and notification.read_at and previous_responsible_id != action.responsible_id:
            notification.read_at = None
            notification.save(update_fields=["read_at", "updated_at"])

    @classmethod
    def resolve_action(cls, action):
        model_name = action.__class__.__name__
        if model_name not in cls.ACTION_CONFIG:
            return
        Notification.objects.filter(
            event_key__startswith=f"problem-action:{model_name}:{action.pk}:",
            resolved_at__isnull=True,
        ).update(resolved_at=timezone.now())
