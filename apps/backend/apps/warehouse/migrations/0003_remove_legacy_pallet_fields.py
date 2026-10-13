from django.db import migrations


class Migration(migrations.Migration):
    dependencies = [("warehouse", "0002_mixed_pallets")]
    operations = [
        migrations.RemoveField(model_name="storagelocation", name="pallet_count"),
        migrations.RemoveField(model_name="storagerack", name="pallet_type"),
    ]
