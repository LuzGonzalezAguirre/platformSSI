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

        self.assertEqual(as_of, "2026-09-15T10:30:00")
        self.assertEqual(rows[0]["elapsed_minutes"], 150)
        self.assertEqual(rows[0]["severity"], "high")
        self.assertEqual(rows[0]["bu"], "TULC")

    def test_severity_thresholds(self):
        self.assertEqual(_severity(59), "normal")
        self.assertEqual(_severity(60), "warning")
        self.assertEqual(_severity(120), "high")
        self.assertEqual(_severity(240), "critical")

    def test_trends_aggregate_hours_and_recurrence(self):
        trends = _build_trends([
            {"date": "2026-09-14", "bu": "VOLVO", "equipment_id": "A", "equipment_description": "A", "hours": 1.5},
            {"date": "2026-09-14", "bu": "VOLVO", "equipment_id": "A", "equipment_description": "A", "hours": 0.5},
        ])
        self.assertEqual(trends["by_day"][0]["hours"], 2.0)
        self.assertEqual(trends["recurrent"][0]["events"], 2)
