import django.db.models.deletion
from django.conf import settings
from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('quality', '0008_replace_catalog_with_failure_mode_image'),
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
    ]

    operations = [
        migrations.CreateModel(
            name='PartNumberScanRule',
            fields=[
                ('id',             models.AutoField(primary_key=True, serialize=False)),
                ('pn_id',          models.IntegerField(unique=True)),
                ('ssi_pn',         models.CharField(max_length=20)),
                ('bu_id',          models.IntegerField()),
                ('bu_name',        models.CharField(max_length=50)),
                ('scan_count',     models.IntegerField(default=1)),
                ('requires_match', models.BooleanField(default=False)),
                ('notes',          models.TextField(blank=True)),
                ('is_active',      models.BooleanField(default=True)),
                ('created_at',     models.DateTimeField(auto_now_add=True)),
                ('updated_at',     models.DateTimeField(auto_now=True)),
                ('created_by', models.ForeignKey(
                    null=True, on_delete=django.db.models.deletion.SET_NULL,
                    related_name='+', to=settings.AUTH_USER_MODEL,
                )),
                ('updated_by', models.ForeignKey(
                    null=True, on_delete=django.db.models.deletion.SET_NULL,
                    related_name='+', to=settings.AUTH_USER_MODEL,
                )),
            ],
            options={'db_table': 'quality_pn_scan_rules'},
        ),
        migrations.CreateModel(
            name='ScanField',
            fields=[
                ('id', models.AutoField(primary_key=True, serialize=False)),
                ('scan_index',       models.IntegerField()),
                ('field_target',     models.CharField(max_length=30, choices=[
                    ('frameSN', 'frameSN'), ('fpcaSN', 'fpcaSN'),
                    ('workOrder', 'workOrder'), ('clientePN', 'clientePN'),
                    ('descartado', 'descartado'),
                ])),
                ('separator',        models.CharField(max_length=20, choices=[
                    ('espacio', 'espacio'), ('apostrofe', 'apostrofe'),
                    ('ninguno', 'ninguno'), ('guion', 'guion'), ('custom', 'custom'),
                ])),
                ('separator_custom', models.CharField(blank=True, max_length=10)),
                ('value_position',   models.CharField(max_length=10, choices=[
                    ('antes', 'antes'), ('despues', 'despues'), ('completo', 'completo'),
                ])),
                ('fixed_length',     models.IntegerField(blank=True, null=True)),
                ('prefix_value',     models.CharField(blank=True, max_length=50)),
                ('display_label',    models.CharField(max_length=100)),
                ('sequence_order',   models.IntegerField(default=0)),
                ('rule', models.ForeignKey(
                    on_delete=django.db.models.deletion.CASCADE,
                    related_name='scan_fields', to='quality.partnumberscanrule',
                )),
            ],
            options={
                'db_table': 'quality_scan_fields',
                'ordering': ['rule', 'scan_index', 'sequence_order'],
            },
        ),
    ]
