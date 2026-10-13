from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):
    initial = True

    dependencies = []

    operations = [
        migrations.CreateModel(
            name="StorageLayout",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("designer_enabled", models.BooleanField(default=False)),
                ("updated_at", models.DateTimeField(auto_now=True)),
            ],
            options={"db_table": "warehouse_storage_layout"},
        ),
        migrations.CreateModel(
            name="StorageRack",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("number", models.PositiveSmallIntegerField(unique=True)),
                ("pallet_type", models.CharField(choices=[("euro", "Euro pallet"), ("standard", "Standard pallet")], default="euro", max_length=8)),
                ("x", models.FloatField(blank=True, null=True)),
                ("y", models.FloatField(blank=True, null=True)),
                ("width", models.FloatField(default=7.5)),
                ("height", models.FloatField(default=12)),
                ("rotation", models.PositiveSmallIntegerField(default=0)),
            ],
            options={"db_table": "warehouse_storage_rack", "ordering": ["number"]},
        ),
        migrations.CreateModel(
            name="StorageLocation",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("level", models.PositiveSmallIntegerField()),
                ("pallet_count", models.PositiveSmallIntegerField(default=0)),
                ("updated_at", models.DateTimeField(auto_now=True)),
                ("rack", models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name="locations", to="warehouse.storagerack")),
            ],
            options={"db_table": "warehouse_storage_location"},
        ),
        migrations.AddConstraint(
            model_name="storagelocation",
            constraint=models.UniqueConstraint(fields=("rack", "level"), name="warehouse_unique_rack_level"),
        ),
    ]
