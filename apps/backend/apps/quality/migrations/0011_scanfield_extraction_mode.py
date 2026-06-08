from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('quality', '0010_update_scanfield_targets'),
    ]

    operations = [
        migrations.AlterField(
            model_name='scanfield',
            name='separator',
            field=models.CharField(
                max_length=20,
                default='ninguno',
                choices=[
                    ('espacio',    'Espacio ( )'),
                    ('apostrofe',  "Apóstrofo (')"),
                    ('guion',      'Guión (-)'),
                    ('guion_bajo', 'Guión bajo (_)'),
                    ('pipe',       'Pipe (|)'),
                    ('ninguno',    'Sin separador'),
                    ('custom',     'Personalizado'),
                ],
            ),
        ),
        migrations.AlterField(
            model_name='scanfield',
            name='value_position',
            field=models.CharField(
                max_length=10,
                default='completo',
                choices=[
                    ('completo', 'Valor completo'),
                    ('antes',    'Antes del separador'),
                    ('despues',  'Después del separador'),
                    ('segmento', 'Segmento por posición'),
                ],
            ),
        ),
        migrations.AddField(
            model_name='scanfield',
            name='extraction_mode',
            field=models.CharField(
                max_length=20,
                default='completo',
                choices=[
                    ('completo',        'Valor completo — sin división'),
                    ('por_separador',   'Dividir por separador'),
                    ('pegado_longitud', 'Prefijo pegado — longitud fija del serial'),
                    ('segmento',        'Segmento por posición (3+ partes)'),
                ],
            ),
        ),
        migrations.AddField(
            model_name='scanfield',
            name='segment_index',
            field=models.IntegerField(
                blank=True,
                null=True,
                help_text='Índice del segmento cuando extraction_mode=segmento',
            ),
        ),
    ]
