from django.db import migrations


def ensure_no_saved_settings(apps, schema_editor):
    """Prevent losing choices if an early deployment saved them in Postgres."""
    Setting = apps.get_model('quality', 'QWallLotSetting')
    if Setting.objects.exists():
        raise RuntimeError(
            'Q-Wall lot settings exist in PostgreSQL. Copy them to CCS first, '
            'then clear the old settings before applying quality.0009.'
        )


class Migration(migrations.Migration):
    dependencies = [('quality', '0008_qwall_lot_sampling')]

    operations = [
        migrations.RunPython(ensure_no_saved_settings, migrations.RunPython.noop),
        migrations.DeleteModel(name='QWallLotModelSetting'),
        migrations.DeleteModel(name='QWallLotSetting'),
        migrations.DeleteModel(name='QWallSamplingCell'),
    ]
