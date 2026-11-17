from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [("production", "0002_alter_attendancerecord_status")]

    operations = [
        migrations.CreateModel(
            name="PackShipIncidentCursor",
            fields=[
                ("source", models.CharField(default="volvo", max_length=48, primary_key=True, serialize=False)),
                ("last_event_id", models.BigIntegerField(default=0)),
                ("updated_at", models.DateTimeField(auto_now=True)),
            ],
            options={"db_table": "production_pack_ship_incident_cursor"},
        ),
        migrations.CreateModel(
            name="PackShipIncidentAlert",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("event_id", models.BigIntegerField(unique=True)),
                ("container_code", models.CharField(max_length=32)),
                ("rejection_type", models.CharField(blank=True, default="", max_length=100)),
                ("payload", models.JSONField(default=dict)),
                ("status", models.CharField(db_index=True, default="pending", max_length=16)),
                ("attempts", models.PositiveSmallIntegerField(default=0)),
                ("last_error", models.TextField(blank=True, default="")),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                ("sent_at", models.DateTimeField(blank=True, null=True)),
            ],
            options={"db_table": "production_pack_ship_incident_alert", "ordering": ["created_at"]},
        ),
    ]
