"""Plex To Promise OTD aggregation regression tests."""
from unittest.mock import patch

from django.test import SimpleTestCase

from apps.warehouse.services.delivery_performance import report


def release(key, scheduled, early, on_time, late, ship_date="2026-09-16"):
    return {
        "Release_Key": key, "Release_No": "", "Planned_Ship_Date": ship_date,
        "Due_Date": ship_date, "Scheduled": scheduled,
        "Quantity_Shipped": early + on_time + late,
        "Early": early, "On_Time": on_time, "Late": late,
        "Quantity_Difference": 0, "Unattributed_Quantity": 0,
        "Customer_No": 1, "Customer_Name": "Example",
        "Part_No": "123.4", "Revision": "1", "PO_No": "PO1",
    }


class DeliveryPerformanceTests(SimpleTestCase):
    def test_release_mean_not_weighted_by_scheduled(self):
        # One large 100% release and one small 0% release must be 50%.
        rows = [release(1, 1000, 0, 1000, 0), release(2, 10, 0, 0, 10)]
        with patch("apps.warehouse.services.delivery_performance.cache.get", return_value=rows):
            result = report(2026)
        self.assertEqual(result["overall"]["percentage"], 50.0)
        self.assertEqual(result["monthly"][0]["percentage"], 50.0)
        self.assertEqual(result["overall"]["scheduled"], 1010)

    def test_partial_fulfillment_uses_scheduled_denominator(self):
        rows = [release(1, 1080, 0, 10, 0)]
        with patch("apps.warehouse.services.delivery_performance.cache.get", return_value=rows):
            result = report(2026)
        self.assertAlmostEqual(result["detail"][0]["performance_pct"], 1000 / 1080)
        self.assertEqual(result["overall"]["percentage"], 0.93)

    def test_month_is_promise_ship_month_not_due_month(self):
        rows = [release(1, 10, 0, 10, 0, "2026-09-29")]
        rows[0]["Due_Date"] = "2026-10-06"
        with patch("apps.warehouse.services.delivery_performance.cache.get", return_value=rows):
            result = report(2026)
        self.assertEqual(result["detail"][0]["month"], 9)
        self.assertEqual(result["monthly"][0]["month"], 9)
