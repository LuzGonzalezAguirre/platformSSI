from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):

    dependencies = [
        ('quality', '0005_nullable_due_dates'),
        ('identity', '0001_initial'),
    ]

    operations = [
        migrations.AlterField(
            model_name='problemattachment',
            name='step',
            field=models.CharField(
                choices=[
                    ('general', 'General'),
                    ('step1', 'D1 - Define Problem'),
                    ('step2', 'D2 - Define Team'),
                    ('step3a', 'D3 - Initial Response'),
                    ('step3b', 'D3 - Containment'),
                    ('step4', 'D4 - Five Why'),
                    ('step5', 'D5 - Corrective Actions'),
                    ('step6', 'D6 - Verification'),
                    ('step7', 'D7 - Control/Prevention'),
                    ('step8', 'D8 - Congratulate Team'),
                ],
                default='general',
                help_text='Step donde se subió el attachment',
                max_length=20,
            ),
        ),
        migrations.CreateModel(
            name='ProblemNote',
            fields=[
                ('id', models.AutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('step', models.CharField(
                    choices=[
                        ('general', 'General'),
                        ('step1', 'D1 - Define Problem'),
                        ('step2', 'D2 - Define Team'),
                        ('step3a', 'D3 - Initial Response'),
                        ('step3b', 'D3 - Containment'),
                        ('step4', 'D4 - Five Why'),
                        ('step5', 'D5 - Corrective Actions'),
                        ('step6', 'D6 - Verification'),
                        ('step7', 'D7 - Control/Prevention'),
                        ('step8', 'D8 - Congratulate Team'),
                    ],
                    default='general',
                    max_length=20,
                )),
                ('text', models.TextField()),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('updated_at', models.DateTimeField(auto_now=True)),
                ('created_by', models.ForeignKey(
                    on_delete=django.db.models.deletion.PROTECT,
                    related_name='problem_notes_created',
                    to='identity.user',
                )),
                ('problem', models.ForeignKey(
                    on_delete=django.db.models.deletion.CASCADE,
                    related_name='notes',
                    to='quality.problem',
                )),
            ],
            options={
                'db_table': 'quality_problem_note',
                'ordering': ['-created_at'],
                'indexes': [models.Index(fields=['problem', 'step'], name='quality_pro_problem_note_idx')],
            },
        ),
    ]
