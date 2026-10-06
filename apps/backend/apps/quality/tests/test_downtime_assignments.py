from unittest.mock import patch

from rest_framework import status
from rest_framework.test import APITestCase

from apps.identity.models import User
from apps.permissions.models import Role, UserRole
from apps.permissions.services import PermissionService


class DowntimeAssignmentsRBACAPITests(APITestCase):
    @classmethod
    def setUpTestData(cls):
        PermissionService.seed_all()

        cls.operator = User.objects.create_user(
            employee_id="dt-operator",
            password="Password123!",
        )
        cls.quality_engineer = User.objects.create_user(
            employee_id="dt-quality",
            password="Password123!",
        )
        cls.supervisor = User.objects.create_user(
            employee_id="dt-supervisor",
            password="Password123!",
        )
        cls.admin = User.objects.create_user(
            employee_id="dt-admin",
            password="Password123!",
        )
        cls.superuser = User.objects.create_superuser(
            employee_id="dt-superuser",
            password="Password123!",
        )

        role_map = {
            cls.operator: "operator",
            cls.quality_engineer: "quality_engineer",
            cls.supervisor: "supervisor",
            cls.admin: "admin",
        }
        for user, role_slug in role_map.items():
            UserRole.objects.create(
                user=user,
                role=Role.objects.get(slug=role_slug),
            )

    def authenticate(self, user):
        self.client.force_authenticate(user=user)

    @patch(
        "apps.quality.views.downtime_assignment_views."
        "downtime_assignment_service.build_assignment_tree",
        return_value=[],
    )
    def test_any_authenticated_role_can_read_assignments(self, build_tree):
        self.authenticate(self.operator)

        response = self.client.get(
            "/api/v1/quality/downtime/assignments/?date=2026-10-06"
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        build_tree.assert_called_once()

    @patch(
        "apps.quality.views.downtime_assignment_views."
        "downtime_assignment_service.save_assignments"
    )
    def test_operator_cannot_replace_assignments(self, save_assignments):
        self.authenticate(self.operator)

        response = self.client.put(
            "/api/v1/quality/downtime/assignments/",
            {"date": "2026-10-06", "groups": [], "overrides": []},
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)
        save_assignments.assert_not_called()

    def _assert_writer_allowed(self, user):
        self.authenticate(user)
        with patch(
            "apps.quality.views.downtime_assignment_views."
            "downtime_assignment_service.save_assignments",
            return_value={
                "date": "2026-10-06",
                "groups_saved": 0,
                "overrides_saved": 0,
            },
        ) as save_assignments:
            response = self.client.put(
                "/api/v1/quality/downtime/assignments/",
                {"date": "2026-10-06", "groups": [], "overrides": []},
                format="json",
            )

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        save_assignments.assert_called_once()

    def test_quality_engineer_can_replace_assignments(self):
        self._assert_writer_allowed(self.quality_engineer)

    def test_supervisor_can_replace_assignments(self):
        self._assert_writer_allowed(self.supervisor)

    def test_admin_can_replace_assignments(self):
        self._assert_writer_allowed(self.admin)

    def test_superuser_can_replace_assignments_without_role(self):
        self._assert_writer_allowed(self.superuser)
