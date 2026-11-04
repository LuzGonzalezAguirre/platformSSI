"""Freshness comparison must not infer pending or overdue from old history."""
from unittest import TestCase
from apps.production.checksheet_freshness import (
    assess_capture_freshness, parse_plex_local,
)


class ChecksheetFreshnessTests(TestCase):
    def test_no_independent_observation_is_not_stale(self):
        result = assess_capture_freshness(None, "2026-10-28T06:55:04")
        self.assertEqual(result["state"], "UNVERIFIED")
        self.assertFalse(result["alert_eligible"])

    def test_older_odbc_capture_is_behind_manual_observation(self):
        result = assess_capture_freshness(
            "2026-11-03T14:49:41", "2026-11-03T10:55:19.940000"
        )
        self.assertEqual(result["state"], "SOURCE_BEHIND_OBSERVATION")
        self.assertFalse(result["alert_eligible"])

    def test_corresponding_odbc_capture_is_visible(self):
        result = assess_capture_freshness(
            "2026-11-03T14:49:41", "2026-11-03T14:49:41.070000"
        )
        self.assertEqual(result["state"], "OBSERVED_CAPTURE_VISIBLE")
        self.assertEqual(result["observation_source"], "MANUAL_PLEX_UI")
        self.assertFalse(result["alert_eligible"])

    def test_truncated_query_never_confirms_freshness(self):
        result = assess_capture_freshness(
            "2026-11-03T14:49:41", "2026-11-03T14:50:00", True
        )
        self.assertEqual(result["state"], "UNVERIFIED")

    def test_missing_capture_when_observed_is_behind(self):
        result = assess_capture_freshness("2026-11-03T14:49:41", None)
        self.assertEqual(result["state"], "SOURCE_BEHIND_OBSERVATION")

    def test_timezone_aware_timestamp_rejected(self):
        with self.assertRaises(ValueError):
            parse_plex_local("2026-11-03T14:49:41-08:00")

    def test_bad_datetime_rejected(self):
        with self.assertRaises(ValueError):
            parse_plex_local("not-a-date")
