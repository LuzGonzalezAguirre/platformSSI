from datetime import date
from decimal import Decimal
from unittest.mock import patch

from django.test import SimpleTestCase, TestCase, override_settings

from apps.warehouse.models import DemandReleaseChangeAlert, DemandReleaseSnapshot
from apps.warehouse.release_change_tasks import (
    monitor_demand_release_changes,
    normalize_release,
    release_differences,
)


def sample_row(status="Open", quantity=91, ship_date="2026-10-28"):
    return {
        "Release_Key": 1001,
        "Customer": "Cummins",
        "PO_Rel": "6000009322",
        "Part_No_Rev": "43861.3.1",
        "Rel_Status": status,
        "Rel_Qty": quantity,
        "Ship_Date": ship_date,
    }


class DemandChangeDetectionTests(SimpleTestCase):
    def test_real_closed_state_not_zero_quantity(self):
        after = normalize_release(sample_row("Closed", 17))
        self.assertEqual(after["release_status"], "Closed")
        self.assertEqual(after["quantity"], Decimal("17"))
        before = {**after, "release_status": "Open"}
        self.assertEqual(release_differences(before, after), ["RELEASE_CLOSED"])

    def test_shipped_is_not_closed(self):
        before = normalize_release(sample_row())
        after = normalize_release(sample_row("Shipped"))
        self.assertEqual(release_differences(before, after), ["STATUS_CHANGED"])

    def test_reopened(self):
        before = normalize_release(sample_row("Closed"))
        after = normalize_release(sample_row("Open"))
        self.assertEqual(release_differences(before, after), ["RELEASE_REOPENED"])

    def test_multiple_changes_one_event(self):
        before = normalize_release(sample_row("Open", 91, "2026-10-28"))
        after = normalize_release(sample_row("Closed", 182, "2026-11-05"))
        self.assertEqual(release_differences(before, after), [
            "RELEASE_CLOSED", "QUANTITY_CHANGED", "SHIP_DATE_CHANGED"
        ])

    def test_normalize_date_and_quantity(self):
        row = normalize_release(sample_row(ship_date="2026-10-28T17:00:00", quantity=3.5))
        self.assertEqual(row["ship_date"], date(2026, 10, 28))
        self.assertEqual(row["quantity"], Decimal("3.5"))


@override_settings(DEMAND_CHANGE_ALERTS_ENABLED=True)
class DemandChangeMonitorTests(TestCase):
    @patch("apps.warehouse.release_change_tasks.cache")
    @patch("apps.warehouse.release_change_tasks.PlexClient")
    def test_first_poll_silently_seeds_then_closed_transition_queues_once(self, client, cache):
        cache.add.return_value = True
        client.return_value.get_demand_status_snapshot.return_value = [sample_row()]
        first = monitor_demand_release_changes()
        self.assertEqual(first["seeded"], 1)
        self.assertEqual(first["changed"], 0)
        self.assertEqual(DemandReleaseChangeAlert.objects.count(), 0)

        client.return_value.get_demand_status_snapshot.return_value = [sample_row("Closed", 91)]
        second = monitor_demand_release_changes()
        self.assertEqual(second["changed"], 1)
        event = DemandReleaseChangeAlert.objects.get()
        self.assertEqual(event.event_type, "RELEASE_CLOSED")
        self.assertEqual(event.status, "pending")
        self.assertEqual(DemandReleaseSnapshot.objects.get().release_status, "Closed")

        third = monitor_demand_release_changes()
        self.assertEqual(third["changed"], 0)
        self.assertEqual(DemandReleaseChangeAlert.objects.count(), 1)

    @patch("apps.warehouse.release_change_tasks.cache")
    @patch("apps.warehouse.release_change_tasks.PlexClient")
    def test_zero_rows_does_not_delete_snapshots(self, client, cache):
        cache.add.return_value = True
        client.return_value.get_demand_status_snapshot.return_value = [sample_row()]
        monitor_demand_release_changes()
        client.return_value.get_demand_status_snapshot.return_value = []
        result = monitor_demand_release_changes()
        self.assertEqual(result["status"], "empty")
        self.assertEqual(DemandReleaseSnapshot.objects.count(), 1)
