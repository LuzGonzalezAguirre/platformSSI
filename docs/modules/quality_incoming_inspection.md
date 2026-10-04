# Incoming Inspection Module

## 1. Scope

Incoming Inspection synchronizes selected Plex container state into PostgreSQL and derives dashboard, pending backlog, KPI, rejection and SLA information from the synchronized data.

The design reduces the need for every interactive request to query Plex directly.

## 2. Persistent entities

IncomingContainerSnapshot represents the current synchronized container state.

IncomingContainerHistory stores historical container changes.

IncomingInspectionSLAConfig stores the configured SLA threshold.

IncomingInspectionSyncState records synchronization timestamp, status and error information.

IncomingRejectionComment stores PlatformSSI comments for rejected serial numbers.

## 3. Source integration

incoming_inspection_plex_repository retrieves source information from Plex.

incoming_inspection_postgres_repository provides local access to synchronized PostgreSQL data.

This creates an explicit external-source-to-local-snapshot boundary.

## 4. Synchronization tasks

sync_incoming_snapshot updates current container state.

sync_incoming_history updates historical container state.

refresh_incoming_inspection coordinates refresh behavior.

sync state is persisted so the application can expose last synchronization status.

## 5. Refresh concurrency control

Incoming Inspection uses the Django cache as a refresh lock.

The refresh task stores task identity in the lock and only removes the lock when it still owns the stored identifier.

The API supports starting a refresh and querying refresh state by task ID.

A regression test verifies that concurrent refresh requests reuse one task.

## 6. Transaction behavior

Snapshot synchronization uses transaction.atomic for grouped PostgreSQL changes.

## 7. Dashboard service

IncomingInspectionDashboardService builds daily trend, top rejected parts and cycle-time histogram information.

It combines synchronized rows with SLA-related calculations.

## 8. Pending service

IncomingInspectionPendingService calculates the current pending backlog.

The service also contains reconciliation logic between history and current filters.

## 9. KPI service

IncomingInspectionKPIService calculates operation counts, inspected lots, acceptance rate, rejected-lot querysets, SLA compliance and detail querysets.

## 10. Rejection comments

Rejected lots can have PlatformSSI-owned comments.

The API supports comment listing and creation by serial number.

## 11. SLA configuration

The API exposes SLA configuration retrieval and patch behavior.

IncomingInspectionSLAConfig retains the previous threshold value in addition to the current value and update audit information.

## 12. User lookup

Incoming Inspection exposes a user-lookup operation through its API.

The supporting service resolves user information used by the module.

## 13. API surface

The API includes refresh start, refresh status, dashboard, pending, KPI, detail, SLA configuration, rejected lots, rejection comments and user lookup.

## 14. Frontend

The frontend route is /quality/incoming-inspection.

## 15. Runtime dependency

The Windows startup process explicitly checks PLEX_PROXY_SECRET inside the Celery worker before considering startup successful because Incoming Inspection depends on Plex access from background tasks.
