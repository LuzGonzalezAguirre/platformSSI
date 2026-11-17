"""Regression tests for opt-in Pack and Ship Teams incident alerts."""
from unittest.mock import Mock, patch

from django.test import SimpleTestCase, TestCase, override_settings

from apps.production.models import PackShipIncidentAlert, PackShipIncidentCursor
from apps.production.tasks import (
    build_pack_ship_incident_card,
    monitor_pack_ship_incidents,
    send_pack_ship_incident_alerts,
)


def row(event_id, code="P978748"):
    return {
        "event_id": event_id,
        "event_token": f"test-{event_id}",
        "rejection_id": event_id + 100,
        "container_code": code,
        "container_id": 17,
        "detected_at": "2026-11-12T10:46:00",
        "rejection_type": "DUPLICATE_SAME",
        "rejection_reason": "Duplicate in same pallet",
        "ssi_scan": "sample-ssi",
        "client_scan": "sample-client",
        "detected_by": "Test operator",
        "approval_status": "BLOCKED",
    }


class PackShipCardTests(SimpleTestCase):
    def test_action_tracker_power_automate_contract(self):
        card = build_pack_ship_incident_card(row(12))
        self.assertEqual(card["event_id"], 12)
        self.assertEqual(card["tipo_alerta"], "PACK_SHIP_INCIDENT")
        attachment = card["attachments"][0]
        self.assertEqual(attachment["contentType"], "application/vnd.microsoft.card.adaptive")
        self.assertEqual(attachment["content"]["type"], "AdaptiveCard")
        self.assertEqual(attachment["content"]["body"][1]["facts"][1]["value"], "P978748")


@override_settings(PACK_SHIP_TEAMS_ALERTS_ENABLED=True)
class PackShipAlertMonitorTests(TestCase):
    @patch("apps.production.tasks.cache")
    @patch("apps.production.tasks._fetch_ccs")
    def test_first_poll_is_silent_and_followup_is_idempotent(self, fetch, cache):
        cache.add.return_value = True
        fetch.side_effect = lambda resource, params=None: (
            [{"last_event_id": 10}] if resource == "alert-head"
            else [row(11), row(12)] if params["after_event_id"] == 10 else []
        )
        self.assertEqual(monitor_pack_ship_incidents()["status"], "seeded")
        self.assertEqual(PackShipIncidentAlert.objects.count(), 0)
        self.assertEqual(monitor_pack_ship_incidents()["queued"], 2)
        self.assertEqual(PackShipIncidentCursor.objects.get().last_event_id, 12)
        self.assertEqual(monitor_pack_ship_incidents()["queued"], 0)
        self.assertEqual(PackShipIncidentAlert.objects.count(), 2)

    @patch("apps.production.tasks.cache")
    @patch("apps.production.tasks._fetch_ccs")
    def test_failure_does_not_advance_cursor(self, fetch, cache):
        cache.add.return_value = True
        PackShipIncidentCursor.objects.create(source="volvo", last_event_id=4)
        fetch.side_effect = RuntimeError("proxy unavailable")
        with self.assertRaises(RuntimeError):
            monitor_pack_ship_incidents()
        self.assertEqual(PackShipIncidentCursor.objects.get().last_event_id, 4)
        self.assertEqual(PackShipIncidentAlert.objects.count(), 0)

    @patch("apps.production.tasks.requests.post")
    def test_send_only_once_after_success(self, post):
        with override_settings(PACK_SHIP_TEAMS_WEBHOOK_URL="https://example.org/flow"):
            PackShipIncidentAlert.objects.create(
                event_id=11, container_code="P978748",
                payload=build_pack_ship_incident_card(row(11)),
            )
            post.return_value = Mock(status_code=202)
            self.assertEqual(send_pack_ship_incident_alerts()["sent"], 1)
            self.assertEqual(send_pack_ship_incident_alerts()["sent"], 0)
            self.assertEqual(post.call_count, 1)
            self.assertEqual(PackShipIncidentAlert.objects.get().status, "sent")

    @patch("apps.production.tasks.requests.post")
    def test_delivery_failure_does_not_store_secret_webhook(self, post):
        from requests import RequestException
        with override_settings(PACK_SHIP_TEAMS_WEBHOOK_URL="https://example.org/secret-token"):
            PackShipIncidentAlert.objects.create(event_id=11, container_code="P978748",
                payload=build_pack_ship_incident_card(row(11)))
            post.side_effect = RequestException("https://example.org/secret-token")
            send_pack_ship_incident_alerts()
            entry = PackShipIncidentAlert.objects.get()
            self.assertEqual(entry.status, "pending")
            self.assertEqual(entry.last_error, "RequestException")
            self.assertNotIn("secret-token", entry.last_error)


class PackShipDisabledTests(SimpleTestCase):
    @override_settings(PACK_SHIP_TEAMS_ALERTS_ENABLED=False)
    def test_disabled_by_default(self):
        self.assertEqual(monitor_pack_ship_incidents()["status"], "disabled")
        self.assertEqual(send_pack_ship_incident_alerts()["status"], "disabled")
