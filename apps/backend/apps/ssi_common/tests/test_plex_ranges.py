from datetime import date
from unittest import TestCase

from apps.ssi_common.plex_ranges import date_chunks


class DateChunksTests(TestCase):
    def test_365_days_are_split_without_gaps_or_overlap(self):
        chunks = list(date_chunks(date(2025, 9, 16), date(2026, 9, 15)))

        self.assertEqual(
            chunks,
            [
                (date(2025, 9, 16), date(2026, 3, 2)),
                (date(2026, 3, 3), date(2026, 8, 17)),
                (date(2026, 8, 18), date(2026, 9, 15)),
            ],
        )
        self.assertEqual(sum((end - start).days + 1 for start, end in chunks), 365)

    def test_custom_chunk_size_honors_production_limit(self):
        chunks = list(date_chunks("2025-09-16", "2026-09-15", chunk_days=120))

        self.assertEqual(len(chunks), 4)
        self.assertTrue(all((end - start).days + 1 <= 120 for start, end in chunks))

    def test_invalid_range_is_rejected(self):
        with self.assertRaises(ValueError):
            list(date_chunks("2026-09-15", "2026-09-14"))
