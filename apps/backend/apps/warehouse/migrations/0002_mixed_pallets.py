from django.db import migrations, models


def migrate_legacy(apps, schema_editor):
    Rack = apps.get_model("warehouse", "StorageRack")
    Location = apps.get_model("warehouse", "StorageLocation")
    for location in Location.objects.select_related("rack").iterator():
        if location.rack.pallet_type == "standard":
            location.standard_pallets = location.pallet_count
        else:
            location.euro_pallets = location.pallet_count
        location.save(update_fields=["standard_pallets", "euro_pallets"])


class Migration(migrations.Migration):
    dependencies = [("warehouse", "0001_initial")]
    operations = [
        migrations.AddField(model_name="storagelocation", name="standard_pallets", field=models.PositiveSmallIntegerField(default=0)),
        migrations.AddField(model_name="storagelocation", name="euro_pallets", field=models.PositiveSmallIntegerField(default=0)),
        migrations.RunPython(migrate_legacy, migrations.RunPython.noop),
    ]
