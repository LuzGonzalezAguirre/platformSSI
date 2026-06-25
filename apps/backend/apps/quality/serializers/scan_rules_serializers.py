from rest_framework import serializers

# Choices replicados sin modelo ORM (Django ya no persiste estas entidades)
EXTRACTION_MODE_CHOICES = [
    ('completo',        'Valor completo — sin división'),
    ('por_separador',   'Dividir por separador'),
    ('pegado_longitud', 'Prefijo pegado — longitud fija del serial'),
    ('segmento',        'Segmento por posición (3+ partes)'),
]

SEPARATOR_CHOICES = [
    ('espacio',    'Espacio ( )'),
    ('apostrofe',  "Apóstrofo (')"),
    ('guion',      'Guión (-)'),
    ('guion_bajo', 'Guión bajo (_)'),
    ('pipe',       'Pipe (|)'),
    ('ninguno',    'Sin separador'),
    ('custom',     'Personalizado'),
]

VALUE_POSITION_CHOICES = [
    ('completo', 'Valor completo'),
    ('antes',    'Antes del separador'),
    ('despues',  'Después del separador'),
    ('segmento', 'Segmento por posición'),
]

FIELD_TARGET_CHOICES = [
    ('frameSN',           'Serial interno (frameSN)'),
    ('volvoSerialNumber', 'Serial del cliente (volvoSerialNumber)'),
    ('descartado',        'Ignorar — solo validación'),
]

_EM_FULL          = 'completo'
_EM_BY_SEP        = 'por_separador'
_EM_PREFIX_LEN    = 'pegado_longitud'
_EM_SEGMENT       = 'segmento'
_SEP_NONE         = 'ninguno'
_SEP_CUSTOM       = 'custom'
_VP_FULL          = 'completo'
_VP_BEFORE        = 'antes'
_VP_AFTER         = 'despues'
_DISCARDED        = 'descartado'


class ScanFieldSerializer(serializers.Serializer):
    id               = serializers.IntegerField(read_only=True, required=False)
    scan_index       = serializers.IntegerField()
    extraction_mode  = serializers.ChoiceField(choices=EXTRACTION_MODE_CHOICES, default=_EM_FULL)
    field_target     = serializers.ChoiceField(choices=FIELD_TARGET_CHOICES)
    separator        = serializers.ChoiceField(choices=SEPARATOR_CHOICES, default=_SEP_NONE)
    separator_custom = serializers.CharField(max_length=10, required=False, default='', allow_blank=True)
    value_position   = serializers.ChoiceField(choices=VALUE_POSITION_CHOICES, default=_VP_FULL)
    segment_index    = serializers.IntegerField(required=False, allow_null=True, default=None)
    fixed_length     = serializers.IntegerField(required=False, allow_null=True, default=None)
    prefix_value     = serializers.CharField(max_length=50, required=False, default='', allow_blank=True)
    display_label    = serializers.CharField(max_length=100)
    sequence_order   = serializers.IntegerField(default=0)

    def validate(self, data):
        mode       = data.get('extraction_mode', _EM_FULL)
        separator  = data.get('separator', _SEP_NONE)
        sep_custom = data.get('separator_custom', '')
        vpos       = data.get('value_position', _VP_FULL)
        seg_idx    = data.get('segment_index')
        fixed_len  = data.get('fixed_length')
        prefix     = data.get('prefix_value', '')

        if separator == _SEP_CUSTOM and not sep_custom:
            raise serializers.ValidationError(
                {'separator_custom': 'Required when separator is "custom".'}
            )

        if mode == _EM_FULL:
            data['value_position'] = _VP_FULL

        elif mode == _EM_BY_SEP:
            if separator == _SEP_NONE:
                raise serializers.ValidationError(
                    {'separator': 'Cannot be "ninguno" when extraction_mode is "por_separador".'}
                )
            if vpos not in (_VP_BEFORE, _VP_AFTER):
                raise serializers.ValidationError(
                    {'value_position': 'Must be "antes" or "despues" for extraction_mode "por_separador".'}
                )

        elif mode == _EM_PREFIX_LEN:
            if not fixed_len:
                raise serializers.ValidationError(
                    {'fixed_length': 'Required when extraction_mode is "pegado_longitud".'}
                )
            if not prefix:
                raise serializers.ValidationError(
                    {'prefix_value': 'Required when extraction_mode is "pegado_longitud".'}
                )

        elif mode == _EM_SEGMENT:
            if seg_idx is None or seg_idx < 0:
                raise serializers.ValidationError(
                    {'segment_index': 'Required (>= 0) when extraction_mode is "segmento".'}
                )
            if separator == _SEP_NONE:
                raise serializers.ValidationError(
                    {'separator': 'Cannot be "ninguno" when extraction_mode is "segmento".'}
                )

        return data


class PartNumberScanRuleSerializer(serializers.Serializer):
    id             = serializers.IntegerField(read_only=True, required=False)
    pn_id          = serializers.IntegerField()
    ssi_pn         = serializers.CharField(max_length=20, read_only=True, required=False)
    bu_id          = serializers.IntegerField(read_only=True, required=False)
    bu_name        = serializers.CharField(max_length=50, read_only=True, required=False)
    scan_count     = serializers.IntegerField(default=1, min_value=1)
    requires_match = serializers.BooleanField(default=False)
    notes          = serializers.CharField(required=False, default='', allow_blank=True)
    is_active      = serializers.BooleanField(default=True)
    field_count    = serializers.IntegerField(read_only=True, required=False)
    scan_fields    = ScanFieldSerializer(many=True)
    created_at     = serializers.DateTimeField(read_only=True, required=False)
    updated_at     = serializers.DateTimeField(read_only=True, required=False)

    def validate(self, data):
        fields_data = data.get('scan_fields', [])
        targets = [
            f['field_target'] for f in fields_data
            if f.get('field_target') != _DISCARDED
        ]
        if len(targets) != len(set(targets)):
            raise serializers.ValidationError(
                'No puede haber dos campos mapeados al mismo destino.'
            )
        return data


class PartNumberScanRuleListSerializer(serializers.Serializer):
    """Versión simplificada para listado — sin scan_fields anidados."""
    id             = serializers.IntegerField()
    pn_id          = serializers.IntegerField()
    ssi_pn         = serializers.CharField()
    bu_id          = serializers.IntegerField()
    bu_name        = serializers.CharField()
    scan_count     = serializers.IntegerField()
    requires_match = serializers.BooleanField()
    is_active      = serializers.BooleanField()
    field_count    = serializers.IntegerField(required=False, default=0)
    created_at     = serializers.DateTimeField(required=False)
    updated_at     = serializers.DateTimeField(required=False)
