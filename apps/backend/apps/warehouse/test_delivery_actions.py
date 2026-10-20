from django.contrib.auth import get_user_model
from django.test import TestCase
from rest_framework.test import APIRequestFactory, force_authenticate

from apps.warehouse.models import DeliveryAction
from apps.warehouse.views.delivery_actions import DeliveryActionsView


class OtdActionsTests(TestCase):
    def setUp(self):
        self.factory = APIRequestFactory()
        self.user = get_user_model().objects.create_user(username="otd_test", password="not-used")

    def test_saved_reason_is_tied_to_chart_period_customer(self):
        record = DeliveryAction.objects.create(
            chart="weeklyCustomers", period_key="2026-10-12", customer="Volvo",
            reason="Shipment was delayed", task="Review transport schedule",
            responsible="Logistics", start_date="2026-10-12", due_date="2026-10-19",
            status="In Progress",
        )
        self.assertEqual(record.chart, "weeklyCustomers")
        self.assertEqual(record.customer, "Volvo")
        self.assertEqual(record.period_key, "2026-10-12")
        self.assertEqual(record.reason, "Shipment was delayed")

    def test_list_requires_authenticated_user(self):
        request = self.factory.get("/api/v1/warehouse/delivery-performance/actions/")
        response = DeliveryActionsView.as_view()(request)
        self.assertIn(response.status_code, (401, 403))
