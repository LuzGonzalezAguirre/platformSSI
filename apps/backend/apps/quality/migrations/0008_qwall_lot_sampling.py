from django.db import migrations, models
import django.db.models.deletion

INDEXES = ['.010', '.015', '.025', '.040', '.065', '.10', '.15', '.25', '.40', '.65', '1.0', '1.5', '2.5', '4.0', '6.5', '10.0']
# GL-QA 02, Rev 00, 11 SEP 2007. None represents the printed * (inspect every piece).
# Transcribed from the complete source image; NULL means the printed asterisk.
ROWS = [
    (2, 8, [None]*12 + [5, 3, 2, 2]),
    (9, 15, [None]*10 + [13, 8, 5, 3, 2, 2]),
    (16, 25, [None]*9 + [20, 13, 8, 5, 3, 3, 2]),
    (26, 50, [None]*8 + [32, 20, 13, 8, 5, 5, 5, 3]),
    (51, 90, [None]*6 + [80, 50, 32, 20, 13, 8, 7, 6, 5, 4]),
    (91, 150, [None]*5 + [125, 80, 50, 32, 20, 13, 12, 11, 7, 6, 5]),
    (151, 280, [None]*4 + [200, 125, 80, 50, 32, 20, 20, 19, 13, 10, 7, 6]),
    (281, 500, [None]*3 + [315, 200, 125, 80, 50, 48, 47, 29, 21, 16, 11, 9, 7]),
    (501, 1200, [None, 800, 500, 315, 200, 125, 80, 75, 73, 47, 34, 27, 19, 15, 11, 8]),
    (1201, 2200, [1250, 800, 500, 315, 200, 125, 120, 116, 73, 53, 42, 35, 23, 18, 13, 9]),
    (2201, 10000, [1250, 800, 500, 315, 200, 192, 189, 116, 89, 68, 50, 38, 29, 22, 15, 9]),
    (10001, 35000, [1250, 800, 500, 315, 300, 294, 189, 135, 108, 77, 60, 46, 35, 29, 15, 9]),
    (35001, 150000, [1250, 800, 500, 490, 476, 294, 218, 170, 123, 96, 74, 56, 40, 29, 15, 9]),
    (150001, 500000, [1250, 800, 750, 715, 476, 345, 270, 200, 156, 119, 90, 64, 40, 29, 15, 9]),
    (501000, None, [1250, 1200, 1112, 715, 556, 435, 303, 244, 189, 143, 102, 64, 40, 29, 15, 9]),
]


def seed_matrix(apps, schema_editor):
    Cell = apps.get_model('quality', 'QWallSamplingCell')
    cells = []
    for minimum, maximum, samples in ROWS:
        assert len(samples) == len(INDEXES)
        for index, sample in zip(INDEXES, samples):
            cells.append(Cell(lot_min=minimum, lot_max=maximum, inspection_index=index, sample_size=sample))
    Cell.objects.bulk_create(cells)


class Migration(migrations.Migration):
    dependencies = [('quality', '0007_cogpsettings')]

    operations = [
        migrations.CreateModel(
            name='QWallLotSetting',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('bu_id', models.PositiveIntegerField(unique=True)),
                ('mode', models.CharField(choices=[('GENERAL', 'General'), ('BY_MODEL', 'By model')], default='GENERAL', max_length=10)),
                ('general_lot_size', models.PositiveIntegerField(blank=True, null=True)),
                ('inspection_index', models.CharField(default='2.5', max_length=5)),
                ('enabled', models.BooleanField(default=False)),
                ('updated_at', models.DateTimeField(auto_now=True)),
            ],
            options={'db_table': 'quality_qwall_lot_setting'},
        ),
        migrations.CreateModel(
            name='QWallSamplingCell',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('lot_min', models.PositiveIntegerField()),
                ('lot_max', models.PositiveIntegerField(blank=True, null=True)),
                ('inspection_index', models.CharField(max_length=5)),
                ('sample_size', models.PositiveIntegerField(blank=True, null=True)),
            ],
            options={'db_table': 'quality_qwall_sampling_cell'},
        ),
        migrations.CreateModel(
            name='QWallLotModelSetting',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('pn_id', models.PositiveIntegerField()),
                ('lot_size', models.PositiveIntegerField()),
                ('setting', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='models', to='quality.qwalllotsetting')),
            ],
            options={'db_table': 'quality_qwall_lot_model_setting'},
        ),
        migrations.AddConstraint(model_name='qwalllotmodelsetting', constraint=models.UniqueConstraint(fields=('setting', 'pn_id'), name='uq_qwall_lot_model')),
        migrations.AddConstraint(model_name='qwallsamplingcell', constraint=models.UniqueConstraint(fields=('lot_min', 'inspection_index'), name='uq_qwall_sampling_cell')),
        migrations.RunPython(seed_matrix, migrations.RunPython.noop),
    ]
