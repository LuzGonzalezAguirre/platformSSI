from django.db import migrations


def create_periodic_tasks(apps, schema_editor):
    CrontabSchedule = apps.get_model("django_celery_beat", "CrontabSchedule")
    PeriodicTask = apps.get_model("django_celery_beat", "PeriodicTask")

    snapshot_schedule, _ = CrontabSchedule.objects.get_or_create(
        minute="*/5", hour="*", day_of_week="*", day_of_month="*", month_of_year="*",
    )
    history_schedule, _ = CrontabSchedule.objects.get_or_create(
        minute="2-59/5", hour="*", day_of_week="*", day_of_month="*", month_of_year="*",
    )

    PeriodicTask.objects.get_or_create(
        name="incoming_inspection.sync_snapshot",
        defaults={
            "task": "apps.quality.tasks.sync_incoming_snapshot",
            "crontab": snapshot_schedule,
        },
    )
    PeriodicTask.objects.get_or_create(
        name="incoming_inspection.sync_history",
        defaults={
            "task": "apps.quality.tasks.sync_incoming_history",
            "crontab": history_schedule,
        },
    )


def remove_periodic_tasks(apps, schema_editor):
    PeriodicTask = apps.get_model("django_celery_beat", "PeriodicTask")
    PeriodicTask.objects.filter(
        name__in=["incoming_inspection.sync_snapshot", "incoming_inspection.sync_history"],
    ).delete()


class Migration(migrations.Migration):

    dependencies = [
        ('quality', '0014_incomingcontainerhistory_incomingcontainersnapshot_and_more'),
        ('django_celery_beat', '0019_alter_periodictasks_options'),
    ]

    operations = [
        migrations.RunPython(create_periodic_tasks, remove_periodic_tasks),
    ]
