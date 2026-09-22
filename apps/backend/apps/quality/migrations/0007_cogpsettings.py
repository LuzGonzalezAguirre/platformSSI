from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [("quality", "0006_problemcontrolsettings")]

    operations = [
        migrations.CreateModel(
            name="CogpSettings",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("cost_target_pct", models.DecimalField(max_digits=5, decimal_places=2, default=2)),
                ("pieces_target_pct", models.DecimalField(max_digits=5, decimal_places=2, default=10)),
                ("updated_at", models.DateTimeField(auto_now=True)),
            ],
            options={"db_table": "quality_cogp_settings"},
        ),
    ]
