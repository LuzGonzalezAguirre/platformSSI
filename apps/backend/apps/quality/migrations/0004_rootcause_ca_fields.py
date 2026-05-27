from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('quality', '0003_rootcause_why_fields'),
    ]

    operations = [
        migrations.AddField(
            model_name='rootcause',
            name='ca1',
            field=models.TextField(blank=True, default=''),
        ),
        migrations.AddField(
            model_name='rootcause',
            name='ca2',
            field=models.TextField(blank=True, default=''),
        ),
        migrations.AddField(
            model_name='rootcause',
            name='ca3',
            field=models.TextField(blank=True, default=''),
        ),
        migrations.AddField(
            model_name='rootcause',
            name='ca4',
            field=models.TextField(blank=True, default=''),
        ),
        migrations.AddField(
            model_name='rootcause',
            name='ca5',
            field=models.TextField(blank=True, default=''),
        ),
    ]
