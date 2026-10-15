"""Tests for temporary, persistent Plex Work Requests audit snapshots."""
import json
import tempfile
from datetime import date, datetime, timedelta, timezone
from pathlib import Path
from unittest.mock import Mock, patch

from django.test import SimpleTestCase
from apps.maintenance.services.work_requests_snapshot_cache import get_work_requests


def make_row(number: str, when: str) -> dict:
    return {"work_request_no": number, "request_date": when, "maintenance_hours": 2.5}


class MonthlyWorkRequestCacheTests(SimpleTestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        self.root = Path(self.temp.name)
        self.today = date(2026, 10, 14)

    def test_months_reused_across_overlapping_ranges(self):
        def fetch(start, end):
            return [make_row(start.strftime("%Y%m%d"), start.isoformat())]
        plex = Mock(side_effect=fetch)
        jan_to_march = get_work_requests(
            date(2026, 1, 1), date(2026, 3, 31), plex,
            root=self.root, today=self.today,
        )
        self.assertEqual(len(jan_to_march), 3)
        self.assertEqual(plex.call_count, 3)
        feb_to_march = get_work_requests(
            date(2026, 2, 1), date(2026, 3, 31), plex,
            root=self.root, today=self.today,
        )
        self.assertEqual(len(feb_to_march), 2)
        self.assertEqual(plex.call_count, 3)

    def test_partial_range_uses_complete_month_but_filters_output(self):
        plex = Mock(return_value=[
            make_row("1", "2026-01-02"),
            make_row("2", "2026-01-28"),
        ])
        rows = get_work_requests(date(2026, 1, 25), date(2026, 1, 29), plex,
                                 root=self.root, today=self.today)
        self.assertEqual([r["work_request_no"] for r in rows], ["2"])
        plex.assert_called_once_with(date(2026, 1, 1), date(2026, 1, 31))

    def test_failed_fetch_does_not_create_snapshot(self):
        plex = Mock(side_effect=RuntimeError("Plex down"))
        with self.assertRaisesRegex(RuntimeError, "Plex down"):
            get_work_requests(date(2026, 1, 1), date(2026, 1, 31), plex,
                              root=self.root, today=self.today)
        self.assertFalse((self.root / "work_requests_2026_01.json").exists())

    def test_tamper_forces_new_plex_fetch(self):
        plex = Mock(return_value=[make_row("1", "2026-01-10")])
        get_work_requests(date(2026, 1, 1), date(2026, 1, 31), plex,
                          root=self.root, today=self.today)
        path = self.root / "work_requests_2026_01.json"
        obj = json.loads(path.read_text())
        obj["rows"][0]["maintenance_hours"] = 999
        path.write_text(json.dumps(obj), encoding="utf-8")
        get_work_requests(date(2026, 1, 1), date(2026, 1, 31), plex,
                          root=self.root, today=self.today)
        self.assertEqual(plex.call_count, 2)

    def test_current_month_refreshes_after_ttl(self):
        plex = Mock(return_value=[make_row("1", "2026-10-01")])
        get_work_requests(date(2026, 10, 1), date(2026, 10, 14), plex,
                          root=self.root, today=self.today)
        path = self.root / "work_requests_2026_10.json"
        obj = json.loads(path.read_text())
        obj["fetched_at"] = (datetime.now(timezone.utc) - timedelta(days=1)).isoformat()
        path.write_text(json.dumps(obj), encoding="utf-8")
        get_work_requests(date(2026, 10, 1), date(2026, 10, 14), plex,
                          root=self.root, today=self.today)
        self.assertEqual(plex.call_count, 2)

    def test_empty_verified_month_is_cached(self):
        plex = Mock(return_value=[])
        for _ in range(2):
            self.assertEqual(
                get_work_requests(date(2026, 2, 1), date(2026, 2, 28), plex,
                                  root=self.root, today=self.today), []
            )
        self.assertEqual(plex.call_count, 1)

    def test_proxy_extra_dates_do_not_abort_or_pollute_month(self):
        plex = Mock(return_value=[
            make_row("valid", "2026-10-12"),
            make_row("outside", "2026-09-30"),
        ])
        with self.assertLogs(
            "apps.maintenance.services.work_requests_snapshot_cache", level="WARNING"
        ) as captured:
            rows = get_work_requests(
                date(2026, 10, 12), date(2026, 10, 14), plex,
                root=self.root, today=self.today,
            )
        self.assertEqual([row["work_request_no"] for row in rows], ["valid"])
        self.assertTrue(any("outside request_date" in line for line in captured.output))
        cached = json.loads((self.root / "work_requests_2026_10.json").read_text())
        self.assertEqual(cached["row_count"], 1)
        self.assertEqual(cached["rows"][0]["work_request_no"], "valid")
        get_work_requests(
            date(2026, 10, 12), date(2026, 10, 14), plex,
            root=self.root, today=self.today,
        )
        self.assertEqual(plex.call_count, 1)

    def test_invalid_request_date_still_rejects_snapshot(self):
        plex = Mock(return_value=[make_row("broken", "not-a-date")])
        with self.assertRaisesRegex(ValueError, "invalid request_date"):
            get_work_requests(
                date(2026, 10, 12), date(2026, 10, 14), plex,
                root=self.root, today=self.today,
            )
        self.assertFalse((self.root / "work_requests_2026_10.json").exists())
