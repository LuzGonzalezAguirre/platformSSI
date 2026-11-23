from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [("warehouse", "0008_release_change_alerts")]

    operations = [
        migrations.AddField(
            model_name="demandreleasesnapshot",
            name="due_date",
            field=models.DateField(null=True),
        ),
        migrations.AddField(
            model_name="demandreleasesnapshot",
            name="shipped",
            field=models.DecimalField(decimal_places=4, max_digits=18, null=True),
        ),
        migrations.AddField(
            model_name="demandreleasesnapshot",
            name="po_status",
            field=models.CharField(blank=True, default="", max_length=40),
        ),
        migrations.AddField(
            model_name="demandreleasesnapshot",
            name="customer_part",
            field=models.CharField(blank=True, default="", max_length=160),
        ),
        migrations.AddField(
            model_name="demandreleasesnapshot",
            name="ship_to_carrier",
            field=models.CharField(blank=True, default="", max_length=160),
        ),
        migrations.AddField(
            model_name="demandreleasesnapshot",
            name="extended_baseline_ready",
            field=models.BooleanField(default=False),
        ),
    ]
