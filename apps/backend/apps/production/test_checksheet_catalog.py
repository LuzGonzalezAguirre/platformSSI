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

    def test_new_groups_are_scoped_to_known_sections(self):
        wc = catalog()[0]
        groups = {group["group_key"]: group for group in wc["groups"]}
        self.assertEqual(len(groups), 3)
        qualification = groups["MACHINE_QUALIFICATION"]
        shift = groups["PRODUCTION_SHIFT_START"]
        self.assertEqual(qualification["department"], "UNASSIGNED")
        self.assertTrue(qualification["freshness_only"])
        self.assertEqual(len(qualification["section_ids"]), 12)
        self.assertTrue(shift["freshness_only"])
        self.assertEqual(len(shift["section_ids"]), 15)
        self.assertEqual(shift["section_ids"][7], 2345881)
        self.assertEqual(shift["operation_numbers"][7], 865)
        self.assertEqual(groups["PRODUCTION_PERIODIC_120"]["section_ids"][-1], 2345917)
        for group in groups.values():
            self.assertEqual(len(group["section_ids"]), len(group["operation_numbers"]))

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
