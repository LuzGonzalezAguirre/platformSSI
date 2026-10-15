"""Persistent Plex Overview cache regression tests."""
import json
import tempfile
from datetime import date
from pathlib import Path
from unittest.mock import Mock

from django.test import SimpleTestCase

from apps.maintenance.services.overview_snapshot_cache import (
    _file_path, get_cached_response,
)


class OverviewSourceCacheTests(SimpleTestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.addCleanup(self.tmp.cleanup)
        self.root = Path(self.tmp.name)
        self.today = date(2026, 10, 15)

    def test_uses_same_source_for_repeated_requests(self):
        payload = {"start_date": "2026-09-01", "end_date": "2026-09-30"}
        fetch = Mock(return_value={"data": {"operating_hours": 12}})
        first = get_cached_response("/maintenance-kpis", payload, fetch,
                                    root=self.root, today=self.today)
        second = get_cached_response("/maintenance-kpis", payload, fetch,
                                     root=self.root, today=self.today)
        self.assertEqual(first, second)
        fetch.assert_called_once()

    def test_distinct_endpoints_are_not_confused(self):
        payload = {"start_date": "2026-09-01", "end_date": "2026-09-30"}
        fetch = Mock(side_effect=[
            {"data": {"a": 1}},
            {"data": {"a": 2}},
        ])
        a = get_cached_response("/maintenance-kpis", payload, fetch,
                                root=self.root, today=self.today)
        b = get_cached_response("/oee-live", payload, fetch,
                                root=self.root, today=self.today)
        self.assertNotEqual(a, b)
        self.assertEqual(fetch.call_count, 2)

    def test_corrupted_cache_reloads_from_plex(self):
        payload = {"start_date": "2026-09-01", "end_date": "2026-09-30"}
        fetch = Mock(return_value={"data": {"operating_hours": 12}})
        get_cached_response("/maintenance-kpis", payload, fetch,
                            root=self.root, today=self.today)
        path = _file_path("/maintenance-kpis", payload, self.root)
        doc = json.loads(path.read_text())
        doc["response"]["data"]["operating_hours"] = 999
        path.write_text(json.dumps(doc))
        result = get_cached_response("/maintenance-kpis", payload, fetch,
                                     root=self.root, today=self.today)
        self.assertEqual(result["data"]["operating_hours"], 12)
        self.assertEqual(fetch.call_count, 2)

    def test_failed_plex_response_is_never_cached(self):
        payload = {"start_date": "2026-09-01", "end_date": "2026-09-30"}
        fetch = Mock(return_value={"message": "failed"})
        with self.assertRaisesRegex(ValueError, "Invalid Plex response"):
            get_cached_response("/maintenance-kpis", payload, fetch,
                                root=self.root, today=self.today)
        self.assertFalse(_file_path("/maintenance-kpis", payload, self.root).exists())

    def test_current_month_cache_reused(self):
        payload = {"start_date": "2026-10-01", "end_date": "2026-10-15"}
        fetch = Mock(return_value={"data": {"total": {"oee_pct": 55}}})
        for _ in range(2):
            get_cached_response("/oee-live", payload, fetch, root=self.root, today=self.today)
        fetch.assert_called_once()

    def test_empty_oee_response_can_be_cached(self):
        payload = {"start_date": "2026-09-01", "end_date": "2026-09-30"}
        fetch = Mock(return_value={"data": None})
        self.assertEqual(
            get_cached_response("/oee-live", payload, fetch,
                                root=self.root, today=self.today),
            {"data": None},
        )

    def test_unapproved_endpoint_always_uses_source(self):
        fetch = Mock(return_value={"data": []})
        payload = {"start_date": "2026-09-01", "end_date": "2026-09-30"}
        for _ in range(2):
            get_cached_response("/other-endpoint", payload, fetch,
                                root=self.root, today=self.today)
        self.assertEqual(fetch.call_count, 2)
