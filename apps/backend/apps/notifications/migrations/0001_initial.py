from django.conf import settings
from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):
    initial = True

    dependencies = [migrations.swappable_dependency(settings.AUTH_USER_MODEL)]

    operations = [
        migrations.CreateModel(
            name="Notification",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("notification_type", models.CharField(max_length=60)),
                ("title", models.CharField(max_length=180)),
                ("message", models.TextField()),
                ("module", models.CharField(db_index=True, max_length=60)),
                ("entity_type", models.CharField(blank=True, max_length=60)),
                ("entity_id", models.PositiveBigIntegerField(blank=True, null=True)),
                ("action_url", models.CharField(blank=True, max_length=300)),
                ("metadata", models.JSONField(blank=True, default=dict)),
                ("event_key", models.CharField(max_length=220, unique=True)),
                ("is_task", models.BooleanField(db_index=True, default=False)),
                ("read_at", models.DateTimeField(blank=True, db_index=True, null=True)),
                ("resolved_at", models.DateTimeField(blank=True, db_index=True, null=True)),
                ("created_at", models.DateTimeField(auto_now_add=True, db_index=True)),
                ("updated_at", models.DateTimeField(auto_now=True)),
                ("actor", models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name="notifications_created", to=settings.AUTH_USER_MODEL)),
                ("recipient", models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name="notifications", to=settings.AUTH_USER_MODEL)),
            ],
            options={"db_table": "core_notification", "ordering": ["-created_at"]},
        ),
        migrations.AddIndex(
            model_name="notification",
            index=models.Index(fields=["recipient", "read_at", "created_at"], name="core_notifi_recipie_8a2ab8_idx"),
        ),
        migrations.AddIndex(
            model_name="notification",
            index=models.Index(fields=["recipient", "is_task", "resolved_at"], name="core_notifi_recipie_02a816_idx"),
        ),
    ]
