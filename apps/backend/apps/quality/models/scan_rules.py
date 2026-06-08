from django.conf import settings
from django.db import models


class PartNumberScanRule(models.Model):
    pn_id          = models.IntegerField(unique=True)
    ssi_pn         = models.CharField(max_length=20)
    bu_id          = models.IntegerField()
    bu_name        = models.CharField(max_length=50)
    scan_count     = models.IntegerField(default=1)
    requires_match = models.BooleanField(default=False)
    notes          = models.TextField(blank=True)
    is_active      = models.BooleanField(default=True)
    created_by     = models.ForeignKey(
        settings.AUTH_USER_MODEL, related_name='+',
        on_delete=models.SET_NULL, null=True,
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, related_name='+',
        on_delete=models.SET_NULL, null=True,
    )
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'quality_pn_scan_rules'

    def __str__(self):
        return f"{self.ssi_pn} (pn_id={self.pn_id})"


class ScanField(models.Model):

    class ExtractionMode(models.TextChoices):
        FULL          = 'completo',        'Valor completo — sin división'
        BY_SEPARATOR  = 'por_separador',   'Dividir por separador'
        PREFIX_LENGTH = 'pegado_longitud', 'Prefijo pegado — longitud fija del serial'
        SEGMENT       = 'segmento',        'Segmento por posición (3+ partes)'

    class Separator(models.TextChoices):
        SPACE      = 'espacio',    'Espacio ( )'
        APOSTROPHE = 'apostrofe',  "Apóstrofo (')"
        HYPHEN     = 'guion',      'Guión (-)'
        UNDERSCORE = 'guion_bajo', 'Guión bajo (_)'
        PIPE       = 'pipe',       'Pipe (|)'
        NONE       = 'ninguno',    'Sin separador'
        CUSTOM     = 'custom',     'Personalizado'

    class ValuePosition(models.TextChoices):
        FULL    = 'completo', 'Valor completo'
        BEFORE  = 'antes',    'Antes del separador'
        AFTER   = 'despues',  'Después del separador'
        SEGMENT = 'segmento', 'Segmento por posición'

    FIELD_TARGET_CHOICES = [
        ('frameSN',           'Serial interno (frameSN)'),
        ('volvoSerialNumber', 'Serial del cliente (volvoSerialNumber)'),
        ('descartado',        'Ignorar — solo validación'),
    ]

    DISCARDED = 'descartado'

    rule             = models.ForeignKey(
        PartNumberScanRule, related_name='scan_fields',
        on_delete=models.CASCADE,
    )
    scan_index       = models.IntegerField()
    extraction_mode  = models.CharField(
        max_length=20,
        choices=ExtractionMode.choices,
        default=ExtractionMode.FULL,
    )
    field_target     = models.CharField(max_length=30, choices=FIELD_TARGET_CHOICES)
    separator        = models.CharField(
        max_length=20,
        choices=Separator.choices,
        default=Separator.NONE,
    )
    separator_custom = models.CharField(max_length=10, blank=True)
    value_position   = models.CharField(
        max_length=10,
        choices=ValuePosition.choices,
        default=ValuePosition.FULL,
    )
    segment_index    = models.IntegerField(
        null=True, blank=True,
        help_text='Índice del segmento cuando extraction_mode=segmento',
    )
    fixed_length     = models.IntegerField(null=True, blank=True)
    prefix_value     = models.CharField(max_length=50, blank=True)
    display_label    = models.CharField(max_length=100)
    sequence_order   = models.IntegerField(default=0)

    class Meta:
        db_table = 'quality_scan_fields'
        ordering = ['rule', 'scan_index', 'sequence_order']

    def __str__(self):
        return f"{self.rule.ssi_pn} | scan={self.scan_index} | {self.field_target}"
