from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('quality', '0004_rootcause_ca_fields'),
    ]

    operations = [
        migrations.AlterField(
            model_name='containmentaction',
            name='due_date',
            field=models.DateField(blank=True, null=True),
        ),
        migrations.AlterField(
            model_name='correctiveaction',
            name='due_date',
            field=models.DateField(blank=True, null=True),
        ),
        migrations.AlterField(
            model_name='verificationaction',
            name='due_date',
            field=models.DateField(blank=True, null=True),
        ),
        migrations.AlterField(
            model_name='preventionaction',
            name='due_date',
            field=models.DateField(blank=True, null=True),
        ),
    ]
