from types import SimpleNamespace

from django.test import SimpleTestCase

from apps.ssi_common.filters.rbac import ALL_BU_CODES, get_allowed_bu_for_user


class BusinessUnitVisibilityPolicyTests(SimpleTestCase):
    def test_all_roles_receive_complete_bu_catalog(self):
        for role in (
            "operator",
            "supervisor",
            "quality_engineer",
            "process_engineer",
            "maintenance_engineer",
            "inventory_engineer",
            "admin",
            "plant_manager",
        ):
            user = SimpleNamespace(role=role)
            self.assertEqual(get_allowed_bu_for_user(user), ALL_BU_CODES)

    def test_custom_or_missing_role_does_not_reduce_bu_visibility(self):
        self.assertEqual(
            get_allowed_bu_for_user(SimpleNamespace(role="custom_role")),
            ALL_BU_CODES,
        )
        self.assertEqual(
            get_allowed_bu_for_user(SimpleNamespace()),
            ALL_BU_CODES,
        )
