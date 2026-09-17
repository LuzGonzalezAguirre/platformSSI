from django.urls import reverse
from rest_framework.test import APITestCase

from apps.identity.models import User
from apps.notifications.models import Notification


class NotificationApiTests(APITestCase):
    def setUp(self):
        self.user = User.objects.create_user(employee_id="1001", password="test-pass")
        self.other_user = User.objects.create_user(employee_id="1002", password="test-pass")
        self.client.force_authenticate(self.user)

    def create_notification(self, recipient=None, **overrides):
        values = {
            "recipient": recipient or self.user,
            "notification_type": "problem_action_assigned",
            "title": "D3 action assigned",
            "message": "PC-2026-0001 · Containment Action",
            "module": "problem_control",
            "event_key": f"event-{Notification.objects.count() + 1}",
            "is_task": True,
        }
        values.update(overrides)
        return Notification.objects.create(**values)

    def test_feed_is_scoped_to_authenticated_user_and_returns_counts(self):
        self.create_notification()
        self.create_notification(recipient=self.other_user)

        response = self.client.get(reverse("notification-list"))

        self.assertEqual(response.status_code, 200)
        self.assertEqual(len(response.data["results"]), 1)
        self.assertEqual(response.data["counts"], {"unread": 1, "pending": 1})

    def test_mark_read_does_not_resolve_pending_task(self):
        notification = self.create_notification()

        response = self.client.post(reverse("notification-read", args=[notification.pk]))

        self.assertEqual(response.status_code, 200)
        notification.refresh_from_db()
        self.assertIsNotNone(notification.read_at)
        self.assertIsNone(notification.resolved_at)

    def test_user_cannot_mark_another_users_notification(self):
        notification = self.create_notification(recipient=self.other_user)

        response = self.client.post(reverse("notification-read", args=[notification.pk]))

        self.assertEqual(response.status_code, 404)
