from rest_framework import serializers
from apps.quality.models.scan_rules import PartNumberScanRule, ScanField

EM = ScanField.ExtractionMode
SP = ScanField.Separator
VP = ScanField.ValuePosition


class ScanFieldSerializer(serializers.ModelSerializer):
    class Meta:
        model  = ScanField
        fields = [
            'id', 'scan_index', 'extraction_mode', 'field_target',
            'separator', 'separator_custom', 'value_position', 'segment_index',
            'fixed_length', 'prefix_value', 'display_label', 'sequence_order',
        ]

    def validate(self, data):
        mode       = data.get('extraction_mode', EM.FULL)
        separator  = data.get('separator', SP.NONE)
        sep_custom = data.get('separator_custom', '')
        vpos       = data.get('value_position', VP.FULL)
        seg_idx    = data.get('segment_index')
        fixed_len  = data.get('fixed_length')
        prefix     = data.get('prefix_value', '')

        # custom separator requires a value
        if separator == SP.CUSTOM and not sep_custom:
            raise serializers.ValidationError(
                {'separator_custom': 'Required when separator is "custom".'}
            )

        if mode == EM.FULL:
            data['value_position'] = VP.FULL

        elif mode == EM.BY_SEPARATOR:
            if separator == SP.NONE:
                raise serializers.ValidationError(
                    {'separator': 'Cannot be "ninguno" when extraction_mode is "por_separador".'}
                )
            if vpos not in (VP.BEFORE, VP.AFTER):
                raise serializers.ValidationError(
                    {'value_position': 'Must be "antes" or "despues" for extraction_mode "por_separador".'}
                )

        elif mode == EM.PREFIX_LENGTH:
            if not fixed_len:
                raise serializers.ValidationError(
                    {'fixed_length': 'Required when extraction_mode is "pegado_longitud".'}
                )
            if not prefix:
                raise serializers.ValidationError(
                    {'prefix_value': 'Required when extraction_mode is "pegado_longitud".'}
                )

        elif mode == EM.SEGMENT:
            if seg_idx is None or seg_idx < 0:
                raise serializers.ValidationError(
                    {'segment_index': 'Required (>= 0) when extraction_mode is "segmento".'}
                )
            if separator == SP.NONE:
                raise serializers.ValidationError(
                    {'separator': 'Cannot be "ninguno" when extraction_mode is "segmento".'}
                )

        return data


class PartNumberScanRuleSerializer(serializers.ModelSerializer):
    scan_fields = ScanFieldSerializer(many=True)
    field_count = serializers.SerializerMethodField()

    class Meta:
        model  = PartNumberScanRule
        fields = [
            'id', 'pn_id', 'ssi_pn', 'bu_id', 'bu_name',
            'scan_count', 'requires_match', 'notes', 'is_active',
            'field_count', 'scan_fields', 'created_at', 'updated_at',
        ]
        read_only_fields = ['ssi_pn', 'bu_id', 'bu_name', 'created_at', 'updated_at']

    def get_field_count(self, obj):
        return obj.scan_fields.count()

    def validate(self, data):
        fields_data = data.get('scan_fields', [])
        targets = [
            f['field_target'] for f in fields_data
            if f.get('field_target') != ScanField.DISCARDED
        ]
        if len(targets) != len(set(targets)):
            raise serializers.ValidationError(
                'No puede haber dos campos mapeados al mismo destino.'
            )
        return data


class PartNumberScanRuleListSerializer(serializers.ModelSerializer):
    field_count = serializers.SerializerMethodField()

    class Meta:
        model  = PartNumberScanRule
        fields = [
            'id', 'pn_id', 'ssi_pn', 'bu_id', 'bu_name',
            'scan_count', 'requires_match', 'is_active',
            'field_count', 'created_at', 'updated_at',
        ]

    def get_field_count(self, obj):
        return obj.scan_fields.count()
