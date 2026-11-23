"""Regression tests: only unplanned WR hours affect equipment rankings and staged actions."""
from datetime import date
from unittest.mock import patch

from django.test import SimpleTestCase

from apps.maintenance.services.work_requests_service import (
    aggregate_unplanned_equipment, is_unplanned_maintenance,
)
from apps.maintenance.services.maintenance_offender_service import (
    stage_weekly_maintenance_offenders,
)


def wr(no, equipment, hours, wr_type="Unplanned Maintenance"):
    return {
        "work_request_no": no,
        "equipment_id": equipment,
        "equipment_description": equipment,
        "workcenter": "WC1",
        "department": "Maintenance",
        "maintenance_hours": hours,
        "type": wr_type,
    }


class UnplannedEquipmentRankingTests(SimpleTestCase):
    def test_excludes_planned_and_missing_equipment_and_sums_hours(self):
        rows = [
            wr("1", "EQ-A", 2),
            wr("2", "EQ-A", 3),
            wr("3", "EQ-B", 4),
            wr("4", "EQ-C", 50, "Planned Maintenance"),
            wr("5", "", 100),
            wr("6", "EQ-Z", 0),
        ]
        result = aggregate_unplanned_equipment(rows)
        self.assertEqual([x["label"] for x in result], ["EQ-A", "EQ-B"])
        self.assertEqual([x["hours"] for x in result], [5.0, 4.0])
        self.assertEqual(result[0]["count"], 2)
        self.assertEqual(result[0]["work_request_nos"], ["1", "2"])
        self.assertEqual(result[1]["work_request_nos"], ["3"])
        self.assertFalse(is_unplanned_maintenance(wr("7", "EQ-C", 1, "Planned Maintenance")))

    def test_pareto_membership_reconciles_with_all_contributing_wr(self):
        rows = [
            wr("101", "EQ-A", 1.25),
            wr("102", "eq-a", 2.75),
            wr("103", "EQ-A", 999, "Planned Maintenance"),
            wr("104", "EQ-B", 8),
            wr("105", "EQ-A", 0),
            wr("106", "EQ-A", -4),
        ]
        ranked = aggregate_unplanned_equipment(rows)
        self.assertEqual(ranked[0]["label"], "EQ-B")
        eq_a = ranked[1]
        self.assertEqual(eq_a["hours"], 4.0)
        self.assertEqual(eq_a["count"], 2)
        self.assertEqual(eq_a["work_request_nos"], ["101", "102"])
        by_no = {row["work_request_no"]: row for row in rows}
        for item in ranked:
            self.assertEqual(
                item["hours"],
                sum(by_no[no]["maintenance_hours"] for no in item["work_request_nos"]),
            )
            self.assertEqual(item["count"], len(item["work_request_nos"]))

    @patch("apps.maintenance.services.maintenance_offender_service._stage")
    @patch("apps.maintenance.services.maintenance_offender_service.WorkRequestsService.get_dashboard")
    def test_weekly_staging_uses_top_three_unplanned_only(self, dashboard, stage):
        dashboard.return_value = {"rows": [
            *[wr(str(i), f"EQ-{i}", 20 - i) for i in range(1, 10)],
            wr("planned", "PLANNED", 1000, "Planned Maintenance"),
        ]}
        stage.side_effect = lambda payload: {"source_key": payload["equipment_id"]}
        result = stage_weekly_maintenance_offenders(date(2026, 10, 10))
        self.assertEqual(result["top_count"], 3)
        self.assertEqual(stage.call_count, 3)
        self.assertEqual(result["equipment"][0]["equipment_id"], "EQ-1")
        self.assertNotIn("PLANNED", [x["equipment_id"] for x in result["equipment"]])
        self.assertEqual(stage.call_args_list[0].args[0]["work_request_count"], 1)
