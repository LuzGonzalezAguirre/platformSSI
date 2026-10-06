from rest_framework import status
from rest_framework.test import APITestCase

from apps.identity.models import User
from apps.permissions.models import Role, UserRole
from apps.permissions.services import PermissionService


class AdministrationRBACAPITests(APITestCase):
    @classmethod
    def setUpTestData(cls):
        PermissionService.seed_all()

        cls.no_access_user = User.objects.create_user(
            employee_id="rbac-none",
            password="Password123!",
        )
        cls.viewer = User.objects.create_user(
            employee_id="rbac-view",
            password="Password123!",
        )
        cls.admin = User.objects.create_user(
            employee_id="rbac-admin",
            password="Password123!",
        )
        cls.superuser = User.objects.create_superuser(
            employee_id="rbac-super",
            password="Password123!",
        )
        cls.target_user = User.objects.create_user(
            employee_id="rbac-target",
            password="Password123!",
        )

        plant_manager = Role.objects.get(slug="plant_manager")
        admin_role = Role.objects.get(slug="admin")
        UserRole.objects.create(user=cls.viewer, role=plant_manager)
        UserRole.objects.create(user=cls.admin, role=admin_role)

        cls.custom_role = Role.objects.create(
            name="RBAC Custom",
            slug="rbac-custom",
            description="Role used by SEC-002 tests",
            is_system=False,
        )

    def authenticate(self, user):
        self.client.force_authenticate(user=user)

    def test_authenticated_user_without_administration_view_is_forbidden(self):
        self.authenticate(self.no_access_user)

        response = self.client.get("/api/v1/auth/users/")

        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

    def test_system_role_with_view_can_read_but_cannot_create(self):
        self.authenticate(self.viewer)

        read_response = self.client.get("/api/v1/auth/users/")
        create_response = self.client.post(
            "/api/v1/auth/users/",
            {
                "employee_id": "rbac-denied-create",
                "first_name": "Denied",
                "last_name": "Create",
                "password": "Password123!",
            },
            format="json",
        )

        self.assertEqual(read_response.status_code, status.HTTP_200_OK)
        self.assertEqual(create_response.status_code, status.HTTP_403_FORBIDDEN)

    def test_admin_system_role_can_create_user(self):
        self.authenticate(self.admin)

        response = self.client.post(
            "/api/v1/auth/users/",
            {
                "employee_id": "rbac-created",
                "first_name": "Created",
                "last_name": "ByAdmin",
                "password": "Password123!",
            },
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertTrue(User.objects.filter(employee_id="rbac-created").exists())

    def test_edit_permission_is_required_for_user_mutations(self):
        self.authenticate(self.viewer)
        denied = self.client.post(
            f"/api/v1/auth/users/{self.target_user.id}/reset-password/",
            {
                "new_password": "NewPassword123!",
                "confirm_password": "NewPassword123!",
            },
            format="json",
        )
        self.assertEqual(denied.status_code, status.HTTP_403_FORBIDDEN)

        self.authenticate(self.admin)
        allowed = self.client.post(
            f"/api/v1/auth/users/{self.target_user.id}/reset-password/",
            {
                "new_password": "NewPassword123!",
                "confirm_password": "NewPassword123!",
            },
            format="json",
        )
        self.assertEqual(allowed.status_code, status.HTTP_200_OK)

    def test_permission_catalog_and_audit_require_administration_view(self):
        self.authenticate(self.no_access_user)
        self.assertEqual(
            self.client.get("/api/v1/permissions/").status_code,
            status.HTTP_403_FORBIDDEN,
        )
        self.assertEqual(
            self.client.get("/api/v1/audit/logs/").status_code,
            status.HTTP_403_FORBIDDEN,
        )

        self.authenticate(self.viewer)
        self.assertEqual(
            self.client.get("/api/v1/permissions/").status_code,
            status.HTTP_200_OK,
        )
        self.assertEqual(
            self.client.get("/api/v1/audit/logs/").status_code,
            status.HTTP_200_OK,
        )

    def test_superuser_bypasses_role_assignment_for_administration_permissions(self):
        self.authenticate(self.superuser)

        response = self.client.delete("/api/v1/permissions/roles/rbac-custom/")

        self.assertEqual(response.status_code, status.HTTP_204_NO_CONTENT)
        self.assertFalse(Role.objects.filter(slug="rbac-custom").exists())

    def test_system_role_cannot_be_deleted_even_by_admin(self):
        self.authenticate(self.admin)

        response = self.client.delete("/api/v1/permissions/roles/admin/")

        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)
        self.assertEqual(
            response.data.get("detail"),
            "Los roles de sistema no pueden eliminarse.",
        )

    def test_my_permissions_remains_available_to_any_authenticated_user(self):
        self.authenticate(self.no_access_user)

        response = self.client.get("/api/v1/permissions/me/")

        self.assertEqual(response.status_code, status.HTTP_200_OK)
