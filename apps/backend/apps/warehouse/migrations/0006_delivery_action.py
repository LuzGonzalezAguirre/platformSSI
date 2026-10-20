from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [("warehouse", "0005_extend_storage_floor_plan_width")]
    operations = [
        migrations.CreateModel(
            name="DeliveryAction",
            fields=[
                ("id", models.BigAutoField(primary_key=True, serialize=False)),
                ("chart", models.CharField(max_length=32, choices=[
                    ("monthlyCustomers", "Monthly OTD by Customer"),
                    ("weeklyCustomers", "Weekly OTD by Customer"),
                    ("weeklyTrend", "Weekly Trend"),
                    ("monthlyTrend", "Monthly Trend"),
                ])),
                ("period_key", models.CharField(max_length=16)),
                ("customer", models.CharField(max_length=180, blank=True, default="")),
                ("reason", models.TextField()),
                ("task", models.TextField()),
                ("responsible", models.CharField(max_length=160)),
                ("start_date", models.DateField()),
                ("due_date", models.DateField()),
                ("status", models.CharField(max_length=32, default="Pending")),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                ("updated_at", models.DateTimeField(auto_now=True)),
            ],
            options={
                "db_table": "warehouse_delivery_action",
                "ordering": ["-created_at"],
            },
        ),
        migrations.AddIndex(
            model_name="deliveryaction",
            index=models.Index(fields=["chart", "period_key", "customer"], name="warehouse_otd_action_lookup"),
        ),
    ]
