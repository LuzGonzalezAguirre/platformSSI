from django.db import migrations


def extend_floor_plan_width(apps, schema_editor):
    """Preserve existing 1200px positions/sizes on a new 1600px canvas.

    Only horizontal coordinates change. This also keeps four-rack capacity
    available to the right of the current row without stretching racks.
    """
    Rack = apps.get_model("warehouse", "StorageRack")
    factor = 1200.0 / 1600.0
    for rack in Rack.objects.all().iterator():
        if rack.x is not None:
            rack.x = rack.x * factor
        rack.width = rack.width * factor
        rack.save(update_fields=["x", "width"])


def restore_horizontal_scale(apps, schema_editor):
    Rack = apps.get_model("warehouse", "StorageRack")
    factor = 1600.0 / 1200.0
    for rack in Rack.objects.all().iterator():
        if rack.x is not None:
            rack.x = rack.x * factor
        rack.width = rack.width * factor
        rack.save(update_fields=["x", "width"])


class Migration(migrations.Migration):
    dependencies = [("warehouse", "0004_storage_locality_crud")]
    operations = [migrations.RunPython(extend_floor_plan_width, restore_horizontal_scale)]
