# Generated for Problem Control D2-D6 workflow updates.
from django.conf import settings
from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):

    dependencies = [
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
        ('quality', '0004_problemcategorycatalog_problemtypecatalog'),
    ]

    operations = [
        migrations.AddField(
            model_name='problem',
            name='manufacturing_approver',
            field=models.ForeignKey(
                blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL,
                related_name='problems_manufacturing_approver',
                to=settings.AUTH_USER_MODEL,
            ),
        ),
        migrations.AddField(
            model_name='problem',
            name='production_approver',
            field=models.ForeignKey(
                blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL,
                related_name='problems_production_approver',
                to=settings.AUTH_USER_MODEL,
            ),
        ),
        migrations.AddField(
            model_name='problem',
            name='maintenance_approver',
            field=models.ForeignKey(
                blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL,
                related_name='problems_maintenance_approver',
                to=settings.AUTH_USER_MODEL,
            ),
        ),
        migrations.AddField(
            model_name='problem',
            name='manufacturing_approved_at',
            field=models.DateTimeField(blank=True, null=True),
        ),
        migrations.AddField(
            model_name='problem',
            name='production_approved_at',
            field=models.DateTimeField(blank=True, null=True),
        ),
        migrations.AddField(
            model_name='problem',
            name='maintenance_approved_at',
            field=models.DateTimeField(blank=True, null=True),
        ),
        migrations.AddField(
            model_name='correctiveaction',
            name='active',
            field=models.BooleanField(default=True),
        ),
        migrations.AddField(
            model_name='problemattachment',
            name='corrective_action',
            field=models.ForeignKey(
                blank=True, null=True, on_delete=django.db.models.deletion.CASCADE,
                related_name='verification_evidence',
                to='quality.correctiveaction',
            ),
        ),
        migrations.AddIndex(
            model_name='problemattachment',
            index=models.Index(
                fields=['problem', 'step', 'corrective_action'],
                name='quality_pro_problem_769607_idx',
            ),
        ),
    ]
