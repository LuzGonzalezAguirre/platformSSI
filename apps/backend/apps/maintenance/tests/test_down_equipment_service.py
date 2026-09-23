from django.test import SimpleTestCase

from apps.maintenance.services.down_equipment_service import (
    _build_trends,
    _normalize_current,
    _severity,
)


class DownEquipmentServiceTests(SimpleTestCase):
    def test_active_zero_hour_log_is_kept_and_timed(self):
        rows, as_of = _normalize_current([{
            "Workcenter_Code": "WC-01",
            "Workcenter": "Final Test",
            "Workcenter_Group": "TULC",
            "Status": "Down",
            "Reason": "Mechanical",
            "Started_At": "2026-09-15T08:00:00",
            "Plex_Now": "2026-09-15T10:30:00",
            "Logged_Hours": 0,
        }])

        self.assertTrue(as_of)
        self.assertEqual(rows[0]["elapsed_minutes"], 150)
        self.assertEqual(rows[0]["severity"], "high")
        self.assertEqual(rows[0]["bu"], "TULC")

    def test_severity_thresholds(self):
        self.assertEqual(_severity(59), "normal")
        self.assertEqual(_severity(60), "warning")
        self.assertEqual(_severity(120), "high")
        self.assertEqual(_severity(240), "critical")

    def test_trends_recurrence_uses_only_equipment_reason(self):
        trends = _build_trends([
            {"date": "2026-09-14", "bu": "VOLVO", "equipment_id": "A", "equipment_description": "A", "reason": "Equipment", "hours": 1.5},
            {"date": "2026-09-13", "bu": "VOLVO", "equipment_id": "A", "equipment_description": "A", "reason": "Mechanical", "hours": 4.0},
            {"date": "2026-09-12", "bu": "VOLVO", "equipment_id": "A", "equipment_description": "A", "reason": " equipment ", "hours": 0.5},
            {"date": "2026-09-11", "bu": "VOLVO", "equipment_id": "B", "equipment_description": "B", "reason": "Idle", "hours": 8.0},
        ])

        # Las tendencias generales conservan todo el historial.
        self.assertEqual(sum(item["hours"] for item in trends["by_day"]), 14.0)

        # Most recurrent equipment solo cuenta Reason=Equipment.
        self.assertEqual(len(trends["recurrent"]), 1)
        self.assertEqual(trends["recurrent"][0]["equipment_id"], "A")
        self.assertEqual(trends["recurrent"][0]["events"], 2)
        self.assertEqual(trends["recurrent"][0]["hours"], 2.0)
        self.assertEqual(len(trends["recurrent"][0]["event_items"]), 2)
        self.assertTrue(all(
            event["reason"].strip().casefold() == "equipment"
            for event in trends["recurrent"][0]["event_items"]
        ))
