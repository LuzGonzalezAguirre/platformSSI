from unittest.mock import patch

from rest_framework import status
from rest_framework.test import APITestCase

from apps.identity.models import User
from apps.permissions.models import Role, UserRole
from apps.permissions.services import PermissionService


class QualityAuthorizationPolicyTests(APITestCase):
    @classmethod
    def setUpTestData(cls):
        PermissionService.seed_all()

        cls.maintenance = User.objects.create_user(
            employee_id="quality-rbac-maint",
            password="Password123!",
        )
        cls.plant_manager = User.objects.create_user(
            employee_id="quality-rbac-manager",
            password="Password123!",
        )
        cls.quality_engineer = User.objects.create_user(
            employee_id="quality-rbac-engineer",
            password="Password123!",
        )
        cls.admin = User.objects.create_user(
            employee_id="quality-rbac-admin",
            password="Password123!",
        )
        cls.override_user = User.objects.create_user(
            employee_id="quality-rbac-override",
            password="Password123!",
        )

        role_map = {
            cls.maintenance: "maintenance_engineer",
            cls.plant_manager: "plant_manager",
            cls.quality_engineer: "quality_engineer",
            cls.admin: "admin",
        }
        for user, role_slug in role_map.items():
            UserRole.objects.create(
                user=user,
                role=Role.objects.get(slug=role_slug),
            )

        PermissionService.set_user_override(
            cls.override_user,
            "quality.view",
            "grant",
        )

    def authenticate(self, user):
        self.client.force_authenticate(user=user)

    def test_user_without_quality_view_cannot_read_quality_endpoint(self):
        self.authenticate(self.maintenance)

        response = self.client.get("/api/v1/quality/targets/")

        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

    def test_quality_view_allows_read_but_not_create(self):
        self.authenticate(self.plant_manager)

        read_response = self.client.get("/api/v1/quality/targets/")
        create_response = self.client.post(
            "/api/v1/quality/targets/",
            {},
            format="json",
        )

        self.assertEqual(read_response.status_code, status.HTTP_200_OK)
        self.assertEqual(create_response.status_code, status.HTTP_403_FORBIDDEN)

    def test_quality_create_allows_request_to_reach_serializer(self):
        self.authenticate(self.quality_engineer)

        response = self.client.post(
            "/api/v1/quality/targets/",
            {},
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_quality_delete_is_independent_from_quality_edit(self):
        self.authenticate(self.quality_engineer)

        response = self.client.delete(
            "/api/v1/quality/catalog/",
            {},
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

        self.authenticate(self.admin)
        admin_response = self.client.delete(
            "/api/v1/quality/catalog/",
            {},
            format="json",
        )

        self.assertEqual(admin_response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_individual_grant_is_honored_by_quality_policy(self):
        self.authenticate(self.override_user)

        response = self.client.get("/api/v1/quality/targets/")

        self.assertEqual(response.status_code, status.HTTP_200_OK)

    def test_individual_revoke_is_honored_by_quality_policy(self):
        PermissionService.set_user_override(
            self.quality_engineer,
            "quality.edit",
            "revoke",
        )
        self.authenticate(self.quality_engineer)

        response = self.client.put(
            "/api/v1/quality/targets/999999/",
            {},
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

    @patch(
        "apps.quality.views.downtime_assignment_views."
        "downtime_assignment_service.build_assignment_tree",
        return_value=[],
    )
    def test_downtime_assignment_read_requires_quality_view(self, build_tree):
        self.authenticate(self.maintenance)

        denied = self.client.get(
            "/api/v1/quality/downtime/assignments/?date=2026-10-06"
        )
        self.assertEqual(denied.status_code, status.HTTP_403_FORBIDDEN)
        build_tree.assert_not_called()

        self.authenticate(self.plant_manager)
        allowed = self.client.get(
            "/api/v1/quality/downtime/assignments/?date=2026-10-06"
        )
        self.assertEqual(allowed.status_code, status.HTTP_200_OK)
        build_tree.assert_called_once()

    def test_downtime_write_keeps_role_exception(self):
        PermissionService.set_user_override(
            self.override_user,
            "quality.edit",
            "grant",
        )
        self.authenticate(self.override_user)

        response = self.client.put(
            "/api/v1/quality/downtime/assignments/",
            {"date": "2026-10-06", "groups": [], "overrides": []},
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

    def test_assigned_approval_discovery_remains_authentication_based_exception(self):
        self.authenticate(self.maintenance)

        response = self.client.get(
            "/api/v1/quality/problems/my-approval-assignments/"
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK)
