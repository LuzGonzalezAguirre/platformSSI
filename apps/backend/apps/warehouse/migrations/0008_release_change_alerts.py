from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [("warehouse", "0007_demand_release_alert")]

    operations = [
        migrations.CreateModel(
            name="DemandReleaseSnapshot",
            fields=[
                ("release_key", models.BigIntegerField(primary_key=True, serialize=False)),
                ("customer", models.CharField(blank=True, default="", max_length=180)),
                ("po", models.CharField(blank=True, default="", max_length=160)),
                ("part", models.CharField(blank=True, default="", max_length=160)),
                ("release_status", models.CharField(max_length=40)),
                ("quantity", models.DecimalField(decimal_places=4, max_digits=18, null=True)),
                ("ship_date", models.DateField(null=True)),
                ("first_observed_at", models.DateTimeField(auto_now_add=True)),
                ("last_observed_at", models.DateTimeField(auto_now=True)),
            ],
            options={"db_table": "warehouse_demand_release_snapshot"},
        ),
        migrations.CreateModel(
            name="DemandReleaseChangeAlert",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("event_key", models.CharField(max_length=64, unique=True)),
                ("release_key", models.BigIntegerField(db_index=True)),
                ("event_type", models.CharField(max_length=40)),
                ("payload", models.JSONField(default=dict)),
                ("status", models.CharField(db_index=True, default="pending", max_length=16)),
                ("attempts", models.PositiveSmallIntegerField(default=0)),
                ("last_error", models.TextField(blank=True, default="")),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                ("sent_at", models.DateTimeField(null=True, blank=True)),
            ],
            options={"db_table": "warehouse_demand_release_change_alert", "ordering": ["created_at"]},
        ),
    ]
