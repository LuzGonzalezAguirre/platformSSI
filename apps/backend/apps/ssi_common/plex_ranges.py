"""Helpers for querying Plex safely over long date ranges."""

from collections.abc import Iterator
from datetime import date, timedelta


PLEX_CHUNK_DAYS = 168


def date_chunks(
    start_date: date | str,
    end_date: date | str,
    chunk_days: int = PLEX_CHUNK_DAYS,
) -> Iterator[tuple[date, date]]:
    """Yield consecutive, non-overlapping inclusive date windows."""
    start = date.fromisoformat(start_date) if isinstance(start_date, str) else start_date
    end = date.fromisoformat(end_date) if isinstance(end_date, str) else end_date

    if end < start:
        raise ValueError("end_date anterior a start_date")
    if chunk_days < 1:
        raise ValueError("chunk_days debe ser mayor a cero")

    current = start
    while current <= end:
        chunk_end = min(current + timedelta(days=chunk_days - 1), end)
        yield current, chunk_end
        current = chunk_end + timedelta(days=1)
