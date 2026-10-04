# Automated Test Inventory

## 1. Scope

This document records automated tests currently present in the repository. Empty test packages are included because they represent the current coverage state.

## 2. Test tooling

The development requirements include pytest, pytest-django, pytest-cov, Factory Boy and Faker.

The repository also contains Django-style unittest test classes.

## 3. Maintenance tests

File: apps/backend/apps/maintenance/tests/test_down_equipment_service.py

Confirmed test cases cover retention and timing of an active zero-hour log, severity-threshold behavior and recurrence trend behavior based on equipment and reason.

The maintenance tests directory otherwise contains only its package initializer in the reviewed repository.

## 4. Notification tests

File: apps/backend/apps/notifications/tests/test_api.py

Confirmed test cases verify that the notification feed is scoped to the authenticated user, marking a notification read does not resolve a pending task, and a user cannot mark another user's notification.

## 5. Incoming Inspection tests

File: apps/backend/apps/quality/tests/test_incoming_refresh.py

The confirmed test verifies that concurrent refresh requests reuse one task rather than creating duplicate refresh jobs.

## 6. Plex range tests

File: apps/backend/apps/ssi_common/tests/test_plex_ranges.py

Confirmed test cases verify that a 365-day range is split without gaps or overlap, custom chunk size honors the intended production limit, and invalid ranges are rejected.

## 7. Q-Wall proxy lot-sampling tests

File: apps/qwall-proxy/tests/test_lot_sampling.py

Confirmed test cases verify that general lot sizes remain independent by business unit, a gap in sampling coverage is rejected, and BY_MODEL mode requires configuration for each relevant business-unit model when enabled.

## 8. Empty or minimal test areas

The following backend areas contain empty test packages or only placeholder test files in the reviewed repository.

| Area | State |
|---|---|
| analytics | Empty tests package |
| audit | Empty tests package |
| core | Empty tests package |
| identity | Empty tests package |
| integrations | Empty tests package |
| manufacturing | Empty tests package |
| permissions | Minimal placeholder tests.py |
| production | Minimal placeholder tests.py |

Quality contains targeted Incoming Inspection tests but does not currently provide repository-wide coverage for its large Problem Control, Q-Wall, COGP and downtime surfaces.

## 9. Coverage boundary

The repository contains meaningful regression tests for selected failure-prone behavior, but the automated test suite is not comprehensive across modules.

No repository evidence reviewed here establishes a required code-coverage threshold, end-to-end browser suite, load-test suite, contract-test suite or failure-injection suite.

Those capabilities should not be represented as current behavior.
