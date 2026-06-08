from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('quality', '0009_add_pn_scan_rules'),
    ]

    operations = [
        migrations.AlterField(
            model_name='scanfield',
            name='field_target',
            field=models.CharField(
                max_length=30,
                choices=[
                    ('frameSN',           'Serial interno (frameSN)'),
                    ('volvoSerialNumber', 'Serial del cliente (volvoSerialNumber)'),
                    ('descartado',        'Ignorar — solo validación'),
                ],
            ),
        ),
    ]
