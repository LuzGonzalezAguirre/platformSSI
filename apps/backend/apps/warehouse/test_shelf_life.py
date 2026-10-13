from datetime import date
from unittest.mock import patch
from django.test import SimpleTestCase
from apps.warehouse.services.shelf_life import shelf_life_report


class ShelfLifeReportTests(SimpleTestCase):
    @patch("apps.warehouse.services.shelf_life.cache")
    @patch("apps.warehouse.services.shelf_life.PlexClient")
    def test_reference_date_and_risk_counts(self, client, cache):
        cache.get.return_value = None
        client.return_value.get_shelf_life.return_value = [
            {"Serial_No": "P959523", "Part_Key": 3498687, "Location": "TJR5-01",
             "Quantity": 45, "Shelf_Date": "2026-04-20", "Expired_Date": "2026-10-20"},
            {"Serial_No": "P1", "Part_Key": 12, "Location": "TJR1-01",
             "Quantity": 1, "Shelf_Date": "2026-01-01", "Expired_Date": "2026-10-01"},
            {"Serial_No": "P2", "Part_Key": 12, "Location": "TJR1-01",
             "Quantity": 1, "Shelf_Date": "2026-01-01", "Expired_Date": "2027-01-01"},
            {"Serial_No": "P3", "Part_Key": 12, "Location": "TJR1-01",
             "Quantity": 1, "Shelf_Date": "2026-01-01", "Expired_Date": None},
            {"Serial_No": "P4", "Part_Key": 12, "Location": "Production",
             "Quantity": 1, "Shelf_Date": "2026-01-01", "Expired_Date": "2026-09-01"},
        ]
        report = shelf_life_report(date(2026, 10, 13), 30)
        self.assertEqual(report["summary"]["total"], 4)
        self.assertEqual(report["summary"]["expired"], 1)
        self.assertEqual(report["summary"]["expiring"], 1)
        self.assertEqual(report["summary"]["ok"], 1)
        self.assertEqual(report["summary"]["unknown"], 1)
        self.assertEqual(report["summary"]["expired_pct"], 25)
        self.assertEqual(report["containers"][1]["serial_no"], "P959523")

    @patch("apps.warehouse.services.shelf_life.cache")
    def test_expired_boundary(self, cache):
        cache.get.return_value = [{"Serial_No": "P959523", "Part_Key": 1,
            "Location": "TJR5-01", "Quantity": 45, "Expired_Date": "2026-10-20"}]
        report = shelf_life_report(date(2026, 10, 21))
        self.assertEqual(report["summary"]["expired"], 1)
