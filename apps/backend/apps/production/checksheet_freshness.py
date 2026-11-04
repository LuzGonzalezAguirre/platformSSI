"""Freshness evidence comparison for Checksheets.

A manually observed Plex capture is a reference for ONE section, WC, part,
control plan, and Plex-local timestamp. A missing recent record can establish
source lag relative to that observation. An old record without such a
reference NEVER establishes staleness or overdue compliance.
"""
from datetime import datetime


def parse_plex_local(value):
    if not isinstance(value, str):
        raise ValueError("Expected Plex-local timestamp text.")
    stamp = datetime.fromisoformat(value)
    if stamp.tzinfo is not None:
        raise ValueError("Use a naive Plex-local timestamp, without timezone.")
    return stamp


def assess_capture_freshness(observed_at, visible_at, evidence_truncated=False):
    """Evaluate one corresponding section's latest capture against manual Plex UI.

    Both datetimes are in Plex's local clock; do not compare UTC to naive data.
    The source observation is manual and not an authoritative automated feed.
    """
    if observed_at is None:
        return {
            "state": "UNVERIFIED",
            "reason": "NO_INDEPENDENT_OBSERVATION",
            "observation_source": None,
            "alert_eligible": False,
        }
    observed = parse_plex_local(observed_at)
    if visible_at is not None:
        visible = parse_plex_local(visible_at)
    else:
        visible = None
    if evidence_truncated:
        state = "UNVERIFIED"
        reason = "QUERY_TRUNCATED"
    elif visible is None or visible < observed:
        state = "SOURCE_BEHIND_OBSERVATION"
        reason = "LATEST_CAPTURE_NOT_YET_VISIBLE_IN_ODBC"
    else:
        state = "OBSERVED_CAPTURE_VISIBLE"
        reason = "ODBC_HAS_CAPTURE_AT_OR_AFTER_REFERENCE"
    return {
        "state": state,
        "reason": reason,
        "observation_source": "MANUAL_PLEX_UI",
        "observed_capture_at": observed.isoformat(),
        "latest_odbc_capture_at": visible.isoformat() if visible else None,
        "alert_eligible": False,
    }
