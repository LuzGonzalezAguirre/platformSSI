from django.db import migrations, models

def mark_existing(apps, schema_editor):
    StorageLayout = apps.get_model("warehouse", "StorageLayout")
    StorageRack = apps.get_model("warehouse", "StorageRack")
    if StorageRack.objects.exists():
        StorageLayout.objects.update_or_create(pk=1, defaults={"initial_racks_seeded": True})

class Migration(migrations.Migration):
    dependencies = [("warehouse", "0003_remove_legacy_pallet_fields")]
    operations = [
        migrations.AddField(model_name="storagelayout", name="initial_racks_seeded", field=models.BooleanField(default=False)),
        migrations.AddField(model_name="storagerack", name="name", field=models.CharField(max_length=80, blank=True, default="")),
        migrations.RunPython(mark_existing, migrations.RunPython.noop),
    ]
