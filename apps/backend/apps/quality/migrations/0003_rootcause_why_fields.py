from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('quality', '0002_holiday_severitylevel_defecttype_problem_and_more'),
    ]

    operations = [
        # Add why1-5 to RootCause (each row is its own why chain)
        migrations.AddField(
            model_name='rootcause',
            name='why1',
            field=models.TextField(blank=True, default=''),
        ),
        migrations.AddField(
            model_name='rootcause',
            name='why2',
            field=models.TextField(blank=True, default=''),
        ),
        migrations.AddField(
            model_name='rootcause',
            name='why3',
            field=models.TextField(blank=True, default=''),
        ),
        migrations.AddField(
            model_name='rootcause',
            name='why4',
            field=models.TextField(blank=True, default=''),
        ),
        migrations.AddField(
            model_name='rootcause',
            name='why5',
            field=models.TextField(blank=True, default=''),
        ),
        # Make root_cause blank (auto-derived from last filled why)
        migrations.AlterField(
            model_name='rootcause',
            name='root_cause',
            field=models.TextField(blank=True),
        ),
        # Make is_final default True (all rows are final in new design)
        migrations.AlterField(
            model_name='rootcause',
            name='is_final',
            field=models.BooleanField(default=True),
        ),
        # Make FiveWhyAnalysis why1-3 optional (why chains live in RootCause rows)
        migrations.AlterField(
            model_name='fivewhyanalysis',
            name='why1',
            field=models.TextField(blank=True, default=''),
        ),
        migrations.AlterField(
            model_name='fivewhyanalysis',
            name='why2',
            field=models.TextField(blank=True, default=''),
        ),
        migrations.AlterField(
            model_name='fivewhyanalysis',
            name='why3',
            field=models.TextField(blank=True, default=''),
        ),
    ]
