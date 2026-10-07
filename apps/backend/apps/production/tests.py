from unittest.mock import patch

from rest_framework import status
from rest_framework.response import Response
from rest_framework.test import APITestCase

from apps.identity.models import User
from apps.permissions.models import Role, UserRole
from apps.permissions.services import PermissionService


class ProductionAuthorizationPolicyTests(APITestCase):
    @classmethod
    def setUpTestData(cls):
        PermissionService.seed_all()

        cls.maintenance = User.objects.create_user(
            employee_id="prbac-maint",
            password="Password123!",
        )
        cls.plant_manager = User.objects.create_user(
            employee_id="prbac-manager",
            password="Password123!",
        )
        cls.operator = User.objects.create_user(
            employee_id="prbac-operator",
            password="Password123!",
        )
        cls.process_engineer = User.objects.create_user(
            employee_id="prbac-process",
            password="Password123!",
        )
        cls.admin = User.objects.create_user(
            employee_id="prbac-admin",
            password="Password123!",
        )
        cls.override_user = User.objects.create_user(
            employee_id="prbac-override",
            password="Password123!",
        )

        role_map = {
            cls.maintenance: "maintenance_engineer",
            cls.plant_manager: "plant_manager",
            cls.operator: "operator",
            cls.process_engineer: "process_engineer",
            cls.admin: "admin",
        }
        for user, role_slug in role_map.items():
            UserRole.objects.create(
                user=user,
                role=Role.objects.get(slug=role_slug),
            )

        PermissionService.set_user_override(
            cls.override_user,
            "production.view",
            "grant",
        )

    def authenticate(self, user):
        self.client.force_authenticate(user=user)

    def test_production_view_allows_read_only_target_access(self):
        self.authenticate(self.maintenance)

        read_response = self.client.get(
            "/api/v1/production/targets/weekly/?week=2026-10-05&bu=volvo"
        )
        write_response = self.client.post(
            "/api/v1/production/targets/weekly/",
            {},
            format="json",
        )

        self.assertNotEqual(read_response.status_code, status.HTTP_403_FORBIDDEN)
        self.assertEqual(write_response.status_code, status.HTTP_403_FORBIDDEN)

    def test_production_edit_allows_target_write_to_reach_serializer(self):
        self.authenticate(self.process_engineer)

        response = self.client.post(
            "/api/v1/production/targets/weekly/",
            {},
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_delete_is_independent_from_edit(self):
        self.authenticate(self.process_engineer)

        denied = self.client.delete(
            "/api/v1/production/earned-hours/?date=2026-10-06"
        )
        self.assertEqual(denied.status_code, status.HTTP_403_FORBIDDEN)

        self.authenticate(self.admin)
        allowed = self.client.delete(
            "/api/v1/production/earned-hours/"
        )
        self.assertEqual(allowed.status_code, status.HTTP_400_BAD_REQUEST)

    def test_individual_grant_is_honored(self):
        self.authenticate(self.override_user)

        response = self.client.get("/api/v1/production/business-units/")

        self.assertEqual(response.status_code, status.HTTP_200_OK)

    def test_individual_revoke_is_honored(self):
        PermissionService.set_user_override(
            self.process_engineer,
            "production.edit",
            "revoke",
        )
        self.authenticate(self.process_engineer)

        response = self.client.post(
            "/api/v1/production/wip/weekly/",
            {},
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

    def test_safety_get_requires_view_not_edit(self):
        self.authenticate(self.maintenance)

        response = self.client.get("/api/v1/production/safety/settings/")

        self.assertEqual(response.status_code, status.HTTP_200_OK)

    @patch(
        "apps.production.views.ccs_views._proxy_post",
        return_value=Response({"ok": True}),
    )
    def test_ccs_query_post_uses_view_permission(self, proxy_post):
        self.authenticate(self.maintenance)

        response = self.client.post(
            "/api/v1/production/ccs/attendance/kpis/",
            {},
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        proxy_post.assert_called_once()

    @patch(
        "apps.production.views.ccs_views._proxy_post",
        return_value=Response({"ok": True}),
    )
    def test_ccs_checkin_requires_create_permission(self, proxy_post):
        self.authenticate(self.maintenance)
        denied = self.client.post(
            "/api/v1/production/ccs/check-in/",
            {},
            format="json",
        )
        self.assertEqual(denied.status_code, status.HTTP_403_FORBIDDEN)
        proxy_post.assert_not_called()

        self.authenticate(self.operator)
        allowed = self.client.post(
            "/api/v1/production/ccs/check-in/",
            {},
            format="json",
        )
        self.assertEqual(allowed.status_code, status.HTTP_200_OK)
        proxy_post.assert_called_once()

    @patch(
        "apps.production.views.ccs_views._proxy_post",
        return_value=Response({"ok": True}),
    )
    def test_ccs_query_post_honors_view_revoke(self, proxy_post):
        PermissionService.set_user_override(
            self.operator,
            "production.view",
            "revoke",
        )
        self.authenticate(self.operator)

        response = self.client.post(
            "/api/v1/production/chairs/kpis/",
            {},
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)
        proxy_post.assert_not_called()
