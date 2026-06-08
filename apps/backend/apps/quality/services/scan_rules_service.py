import os
import requests
from rest_framework.exceptions import ValidationError
from apps.quality.models.scan_rules import PartNumberScanRule, ScanField

PROXY_URL   = os.getenv("QWALL_PROXY_URL",   "http://host.docker.internal:8002")
PROXY_TOKEN = os.getenv("QWALL_PROXY_TOKEN", "")
_HEADERS    = {"Authorization": f"Bearer {PROXY_TOKEN}"}
_TIMEOUT    = 10


def _fetch_pn_details(pn_id: int) -> dict:
    """Resolve ssi_pn, bu_id, bu_name from SQL Server via qwall-proxy.
    Raises ValidationError if the proxy is unreachable or the PN does not exist.
    """
    try:
        resp = requests.get(
            f"{PROXY_URL}/settings/part-numbers-lookup",
            headers=_HEADERS,
            timeout=_TIMEOUT,
        )
        resp.raise_for_status()
        items = resp.json().get("data", [])
    except Exception as exc:
        raise ValidationError(f"Cannot reach qwall-proxy to verify PN: {exc}")

    for item in items:
        if item.get("pn_id") == pn_id:
            return item

    raise ValidationError(f"pn_id={pn_id} not found in ssi_PartNumbers.")


class ScanRulesService:

    @staticmethod
    def get_all_rules(bu_id=None, is_active=None):
        qs = PartNumberScanRule.objects.prefetch_related('scan_fields')
        if bu_id is not None:
            qs = qs.filter(bu_id=bu_id)
        if is_active is not None:
            qs = qs.filter(is_active=is_active)
        return qs.order_by('ssi_pn')

    @staticmethod
    def get_rule(rule_id: int):
        try:
            return PartNumberScanRule.objects.prefetch_related('scan_fields').get(pk=rule_id)
        except PartNumberScanRule.DoesNotExist:
            return None

    @staticmethod
    def get_rule_by_pn(pn_id: int):
        try:
            return PartNumberScanRule.objects.prefetch_related('scan_fields').get(pn_id=pn_id)
        except PartNumberScanRule.DoesNotExist:
            return None

    @staticmethod
    def _validate_no_duplicate_pn(pn_id: int, exclude_rule_id=None):
        qs = PartNumberScanRule.objects.filter(pn_id=pn_id)
        if exclude_rule_id:
            qs = qs.exclude(pk=exclude_rule_id)
        if qs.exists():
            raise ValidationError(f"A scan rule for pn_id={pn_id} already exists.")

    @staticmethod
    def create_rule(data: dict, user) -> PartNumberScanRule:
        pn_id = data['pn_id']
        ScanRulesService._validate_no_duplicate_pn(pn_id)

        pn_info = _fetch_pn_details(pn_id)
        fields_data = data.pop('scan_fields', [])

        rule = PartNumberScanRule.objects.create(
            pn_id          = pn_id,
            ssi_pn         = pn_info['ssiPN'],
            bu_id          = pn_info['bu_id'],
            bu_name        = pn_info.get('bu_name', ''),
            scan_count     = data.get('scan_count', 1),
            requires_match = data.get('requires_match', False),
            notes          = data.get('notes', ''),
            is_active      = data.get('is_active', True),
            created_by     = user,
            updated_by     = user,
        )
        for fd in fields_data:
            ScanField.objects.create(rule=rule, **fd)

        return PartNumberScanRule.objects.prefetch_related('scan_fields').get(pk=rule.pk)

    @staticmethod
    def update_rule(rule_id: int, data: dict, user) -> PartNumberScanRule | None:
        rule = ScanRulesService.get_rule(rule_id)
        if rule is None:
            return None

        new_pn_id = data.get('pn_id', rule.pn_id)
        if new_pn_id != rule.pn_id:
            ScanRulesService._validate_no_duplicate_pn(new_pn_id, exclude_rule_id=rule_id)
            pn_info = _fetch_pn_details(new_pn_id)
            rule.pn_id   = new_pn_id
            rule.ssi_pn  = pn_info['ssiPN']
            rule.bu_id   = pn_info['bu_id']
            rule.bu_name = pn_info.get('bu_name', '')

        for field in ('scan_count', 'requires_match', 'notes', 'is_active'):
            if field in data:
                setattr(rule, field, data[field])

        rule.updated_by = user
        rule.save()

        if 'scan_fields' in data:
            rule.scan_fields.all().delete()
            for fd in data['scan_fields']:
                ScanField.objects.create(rule=rule, **fd)

        return PartNumberScanRule.objects.prefetch_related('scan_fields').get(pk=rule.pk)

    @staticmethod
    def toggle_active(rule_id: int, user) -> PartNumberScanRule | None:
        rule = ScanRulesService.get_rule(rule_id)
        if rule is None:
            return None
        rule.is_active  = not rule.is_active
        rule.updated_by = user
        rule.save(update_fields=['is_active', 'updated_by', 'updated_at'])
        return rule

    @staticmethod
    def delete_rule(rule_id: int) -> bool:
        rule = ScanRulesService.get_rule(rule_id)
        if rule is None:
            return False
        rule.delete()
        return True
