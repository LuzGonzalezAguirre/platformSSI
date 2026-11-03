"""Pilot checksheet monitor invariants: never infer current compliance."""
from unittest import TestCase

from apps.production.checksheet_catalog import catalog, summarize_monitor


class ChecksheetCatalogTests(TestCase):
    def test_verified_pilot_catalog_is_explicit_and_deterministic(self):
        rows = catalog()
        self.assertEqual(len(rows), 1)
        wc = rows[0]
        self.assertEqual(wc["area_key"], "VOLVO")
        self.assertEqual(wc["workcenter_key"], 75408)
        self.assertEqual(wc["control_plan_key"], 446576)
        self.assertEqual(wc["groups"][0]["department"], "PRODUCTION")
        self.assertEqual(
            wc["groups"][0]["section_ids"],
            [2345913, 2345914, 2345915, 2345916, 2345917]
        )

    def test_historically_complete_never_means_currently_completed(self):
        row = catalog()[0]
        group = row["groups"][0]
        output = summarize_monitor([{**row, "groups": [{
            "group_key": group["group_key"],
            "department": "PRODUCTION",
            "historical_sequence_state": "LATEST_OBSERVED_SEQUENCE_COMPLETE",
            "complete_historical_cycles": 165,
        }]}])
        wc = output["areas"][0]["workcenters"][0]
        self.assertEqual(wc["status"], "UNVERIFIED")
        self.assertEqual(wc["department_results"][0]["status"], "UNVERIFIED")
        self.assertEqual(wc["departments_not_evaluated"], ["QUALITY"])
        self.assertFalse(output["teams_notifications_enabled"])
        self.assertFalse(output["current_plex_status_verified"])

    def test_unconfigured_departments_not_claimed_complete(self):
        output = summarize_monitor(catalog())
        wc = output["areas"][0]["workcenters"][0]
        self.assertEqual(wc["departments_not_evaluated"], ["QUALITY"])
        self.assertEqual(wc["status"], "UNVERIFIED")
