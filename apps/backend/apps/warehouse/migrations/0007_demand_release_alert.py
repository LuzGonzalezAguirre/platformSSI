from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [("warehouse", "0006_delivery_action")]

    operations = [
        migrations.CreateModel(
            name="DemandReleaseAlert",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("release_key", models.BigIntegerField(unique=True)),
                ("ship_month", models.DateField(db_index=True)),
                ("payload", models.JSONField(default=dict)),
                ("status", models.CharField(db_index=True, default="pending", max_length=16)),
                ("attempts", models.PositiveSmallIntegerField(default=0)),
                ("last_error", models.TextField(blank=True, default="")),
                ("first_seen_at", models.DateTimeField(auto_now_add=True)),
                ("sent_at", models.DateTimeField(blank=True, null=True)),
            ],
            options={"db_table": "warehouse_demand_release_alert", "ordering": ["first_seen_at"]},
        ),
    ]
