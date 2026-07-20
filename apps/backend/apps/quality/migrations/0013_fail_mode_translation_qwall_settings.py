import django.db.models.deletion
from django.conf import settings
from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('quality', '0012_drop_scan_rules_from_postgres'),
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
    ]

    operations = [
        migrations.CreateModel(
            name='FailModeTranslation',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('fail_mode_code', models.CharField(max_length=100)),
                ('locale', models.CharField(max_length=10)),
                ('name', models.CharField(max_length=255)),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('updated_at', models.DateTimeField(auto_now=True)),
            ],
            options={
                'verbose_name': 'Fail Mode Translation',
                'verbose_name_plural': 'Fail Mode Translations',
                'db_table': 'quality_fail_mode_translations',
            },
        ),
        migrations.AddIndex(
            model_name='failmodetranslation',
            index=models.Index(fields=['fail_mode_code'], name='quality_fai_fail_mo_2f6a1c_idx'),
        ),
        migrations.AlterUniqueTogether(
            name='failmodetranslation',
            unique_together={('fail_mode_code', 'locale')},
        ),
        migrations.CreateModel(
            name='QWallSettings',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('pass_rate_target', models.DecimalField(decimal_places=2, default=95.00, max_digits=5)),
                ('updated_at', models.DateTimeField(auto_now=True)),
                ('updated_by', models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name='qwall_settings_updated', to=settings.AUTH_USER_MODEL)),
            ],
            options={
                'verbose_name': 'QWall Settings',
                'db_table': 'quality_qwall_settings',
            },
        ),
    ]
