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
        body = attachment["content"]["body"]
        self.assertEqual(body[0]["items"][0]["text"], "PACK AND SHIP VOLVO")
        self.assertEqual(body[0]["style"], "accent")
        facts = {fact["title"]: fact["value"] for fact in body[1]["facts"]}
        self.assertNotIn("Evento", facts)
        self.assertEqual(facts["No. de Lote"], "P978748")
        self.assertEqual(facts["Tipo de incidencia"], "Pieza duplicada en el mismo lote")
        self.assertEqual(facts["Operador"], "Test operator")
        self.assertEqual(facts["Serial SSI"], "sample-ssi")
        self.assertEqual(facts["Serial cliente"], "sample-client")
        self.assertEqual(facts["Detectado"], "12/11/2026 02:46:00 AM")

    def test_qwall_incident_alias(self):
        payload = build_pack_ship_incident_card({
            **row(14), "rejection_type": "QWALL_REJECT",
        })
        facts = {
            f["title"]: f["value"]
            for f in payload["attachments"][0]["content"]["body"][1]["facts"]
        }
        self.assertEqual(facts["Tipo de incidencia"], "Pieza rechazada por Q-Wall")

    def test_current_utc_timestamp_is_rendered_in_tijuana(self):
        payload = build_pack_ship_incident_card({
            **row(13), "detected_at": "2026-11-17T19:57:27+00:00",
            "approval_departments": ["Calidad", "Producción"],
        })
        facts = {
            f["title"]: f["value"]
            for f in payload["attachments"][0]["content"]["body"][1]["facts"]
        }
        self.assertEqual(facts["Detectado"], "17/11/2026 11:57:27 AM")
        self.assertEqual(facts["Se espera aprobación de"], "Calidad, Producción")



@override_settings(PACK_SHIP_TEAMS_ALERTS_ENABLED=True)
class PackShipAlertMonitorTests(TestCase):
    @patch("apps.production.tasks.cache")
    @patch("apps.production.tasks._fetch_ccs")
    def test_first_poll_is_silent_and_followup_is_idempotent(self, fetch, cache):
        cache.add.return_value = True
        fetch.side_effect = lambda resource, params=None: (
            [{"last_event_id": 10}] if resource == "alert-head"
            else [{"name": "Calidad"}, {"name": "Producción"}] if resource == "approval-departments"
            else [row(11), row(12)] if params["after_event_id"] == 10 else []
        )
        self.assertEqual(monitor_pack_ship_incidents()["status"], "seeded")
        self.assertEqual(PackShipIncidentAlert.objects.count(), 0)
        self.assertEqual(monitor_pack_ship_incidents()["queued"], 2)
        self.assertEqual(PackShipIncidentCursor.objects.get().last_event_id, 12)
        self.assertEqual(monitor_pack_ship_incidents()["queued"], 0)
        self.assertEqual(PackShipIncidentAlert.objects.count(), 2)
        alert = PackShipIncidentAlert.objects.get(event_id=11)
        facts = {
            f["title"]: f["value"]
            for f in alert.payload["attachments"][0]["content"]["body"][1]["facts"]
        }
        self.assertEqual(facts["Se espera aprobación de"], "Calidad, Producción")

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
