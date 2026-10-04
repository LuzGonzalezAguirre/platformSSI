# Current Data Flows

## 1. Purpose

This document describes the principal data flows implemented in PlatformSSI. It records the sequence of components involved in request processing, persistence, caching and external integration.

The flows are current-state descriptions. They do not imply that the present sequence is the final target architecture.

## 2. Authentication flow

```text
Browser
  |
  v
React LoginPage
  |
  v
POST api/v1/auth/login
  |
  v
Django LoginView
  |
  v
AuthService
  |
  v
identity.User
  |
  v
JWT access and refresh tokens
  |
  v
Zustand authentication state
  |
  v
Protected React routes
```

The custom user identifier used in JWT claims is employee_id.

Authenticated API requests send Bearer tokens and are validated by Django REST Framework SimpleJWT.

## 3. Generic authenticated read flow

```text
React module
  |
  v
Axios or module service
  |
  v
api/v1 endpoint
  |
  v
Django APIView
  |
  v
Domain service
  |
  +-------------------+
  |                   |
  v                   v
PostgreSQL         External repository
                      |
                      v
                   Redis cache
                      |
                      v
                    Proxy
                      |
                      v
                External source
```

The exact path varies by domain. Some modules read only PostgreSQL. Others perform proxy-based integration and cache the resulting data.

## 4. Q-Wall reporting flow

```text
React Quality Q-Wall
  |
  v
api/v1/quality/qwall
  |
  v
QWallReportView
  |
  v
QWallService
  |
  +--> derived-response Redis cache
  |
  v on miss
QWallRepository
  |
  +--> raw-data Redis cache
  |
  v on miss
Q-Wall proxy :8002
  |
  v
SQL Server / CCS
  |
  v
Inspection and quality tables
```

Q-Wall therefore contains two application cache layers: repository-level source-data cache and service-level aggregate cache.

## 5. Q-Wall settings flow

```text
React Q-Wall Settings
  |
  v
api/v1/quality/qwall/settings
  |
  v
Django settings views
  |
  v
Q-Wall proxy :8002
  |
  v
SQL Server / CCS configuration tables
```

Selected settings are local to PostgreSQL, including the PlatformSSI Q-Wall pass-rate target and failure-mode translations. Catalog administration and lot sampling are proxy-backed.

## 6. Q-Wall lot-sampling flow

```text
React Q-Wall Settings
  |
  v
Django lot-sampling views
  |
  v
Q-Wall proxy
  |
  v
dbo.ssi_QWallLotSettings
dbo.ssi_QWallLotModelSettings
dbo.ssi_QWallSamplingMatrix
```

PostgreSQL models for this functionality existed historically but were removed in migration 0009.

## 7. OPS Daily Report flow

```text
React OPS Daily Report
  |
  v
api/v1/production/ops
  |
  v
OPS report views
  |
  v
OpsReportService
  |
  +--> Redis cache
  |
  +--> PostgreSQL targets / WIP / earned hours where required
  |
  v
Plex proxy :8001
  |
  v
Plex
```

The report service combines external operational values with PlatformSSI-owned values.

## 8. Maintenance overview flow

```text
React Maintenance Overview
  |
  v
api/v1/maintenance/overview
  |
  v
MaintenanceService
  |
  +--> Redis cache
  |
  v on miss
Plex proxy
  |
  v
Plex maintenance and production data
  |
  v
KPI, downtime and OEE transformations
```

Filter context participates in cache-key generation for several maintenance results.

## 9. Work Requests flow

```text
React Work Requests
  |
  v
WorkRequestsDashboardView
  |
  v
WorkRequestsService
  |
  +--> cached Plex-derived dashboard result
  |
  +--> live Action Tracker lookup
  |
  v
Combined dashboard response
```

Action Tracker references are deliberately added after the cached Plex portion is loaded.

## 10. Down Equipment flow

```text
React Down Equipment
  |
  v
DownEquipmentDashboardView
  |
  v
DownEquipmentService
  |
  +--> 30-second current-state cache
  |
  +--> 600-second history cache
  |
  v
Plex proxy
  |
  v
Current and historical equipment events
```

The service normalizes source timestamps, assigns severity and derives trend information.

## 11. COGP live analytical flow

```text
React COGP or Scrap Rate
  |
  v
api/v1/quality/cogp
  |
  v
COGP service
  |
  +--> Redis day or week cache
  |
  v on miss
QualityPlexClient
  |
  v
Plex proxy
  |
  v
Plex scrap and production records
  |
  v
Business-unit classification and calculation
```

The daily and weekly services use different cache policies according to whether periods are open or closed.

## 12. COGP synchronized flow

```text
Celery task or synchronization call
  |
  v
PlexSyncService
  |
  v
QualityPlexClient
  |
  v
Plex proxy
  |
  v
Plex
  |
  v
CustomerPartMapping
ProductionRecord
ScrapRecord
COGPDailySummary
```

This path creates PostgreSQL-owned snapshots derived from Plex and is distinct from live query paths.

## 13. COGP weekly offender flow

```text
Celery Beat
Saturday 07:00
  |
  v
stage_weekly_cogp_offenders
  |
  v
Scrap offender calculation
  |
  v
Q-Wall proxy /scrap-offenders/stage
  |
  v
dbo.ssi_ScrapOffenderActions
  |
  v
Action Tracker processing path
```

SourceKey provides deterministic staging identity in the SQL integration table.

## 14. Maintenance weekly offender flow

```text
Celery Beat
Saturday 07:15
  |
  v
stage_weekly_maintenance_offenders_task
  |
  v
Maintenance offender calculation
  |
  v
Q-Wall proxy /maintenance-offenders/stage
  |
  v
dbo.ssi_MaintenanceOffenderActions
  |
  v
Action Tracker processing path
```

The staging table tracks processing status, attempts, Action Tracker code and errors.

## 15. Incoming Inspection synchronization flow

```text
Refresh API or background task
  |
  +--> Redis refresh lock
  |
  v
Celery worker
  |
  v
Incoming Plex repository
  |
  v
Plex proxy
  |
  v
Plex
  |
  v
PostgreSQL
  |
  +--> IncomingContainerSnapshot
  |
  +--> IncomingContainerHistory
  |
  +--> IncomingInspectionSyncState
```

Interactive Incoming Inspection dashboards primarily read the synchronized PostgreSQL state rather than querying Plex for each dashboard request.

## 16. Incoming Inspection read flow

```text
React Incoming Inspection
  |
  v
api/v1/quality/incoming-inspection
  |
  v
Dashboard / pending / KPI service
  |
  v
PostgreSQL synchronized entities
  |
  v
Derived dashboard response
```

This separation reduces direct source dependency during normal interactive reads.

## 17. Problem Control flow

```text
React Problem Control
  |
  v
api/v1/quality/problems
  |
  v
Problem views
  |
  v
ProblemService
  |
  v
PostgreSQL Problem aggregate
  |
  +--> actions
  |
  +--> five-why and root causes
  |
  +--> approvals
  |
  +--> attachments and notes
  |
  +--> ProblemAudit
  |
  +--> NotificationService
```

Problem Control is primarily a PlatformSSI-owned transactional workflow.

## 18. Notification flow

```text
Domain state change
  |
  v
NotificationService
  |
  v
event_key construction
  |
  v
Notification PostgreSQL row
  |
  v
api/v1/notifications
  |
  v
Authenticated recipient frontend
```

The unique event_key prevents multiple rows for the same logical notification event when the same key is reused.

## 19. Generic audit flow

```text
Successful POST / PUT / PATCH / DELETE
  |
  v
Django response
  |
  v
AuditMiddleware
  |
  +--> validate Bearer JWT
  |
  +--> derive module and resource
  |
  v
AuditLog
```

Audit failures are suppressed and do not change the original response.

## 20. CCS attendance flow

```text
React Production Assistance or CCS function
  |
  v
api/v1/production/ccs
  |
  v
Production CCS view
  |
  v
Q-Wall proxy
  |
  v
SQL Server
  |
  +--> ssi_Attendance
  |
  +--> ssi_production_employee
  |
  +--> attendance stored procedures
```

The same proxy exposes employee management and attendance KPI behavior.

## 21. Chair-control flow

```text
React chair-related production view
  |
  v
api/v1/production/chairs
  |
  v
Production CCS views
  |
  v
Q-Wall proxy
  |
  v
ssi_ChairUsage
  |
  v
KPI and chart responses
```

## 22. Warehouse flow

```text
React Warehouse
  |
  v
api/v1/warehouse
  |
  v
Warehouse view
  |
  v
WarehouseService
  |
  v
PlexClient
  |
  v
Plex proxy
  |
  v
Plex BOM / revision / demand data
```

The current Warehouse domain does not own a confirmed active Django data model for these source records.

## 23. Source-of-truth summary

| Data category | Primary source represented in current architecture |
|---|---|
| Platform users, roles and permissions | PostgreSQL |
| Platform audit and notifications | PostgreSQL |
| Production targets, WIP and OEE manual records | PostgreSQL |
| Safety and PlatformSSI attendance records | PostgreSQL |
| Problem Control | PostgreSQL |
| Maintenance corrective actions and targets | PostgreSQL |
| Q-Wall inspections and operational catalogs | SQL Server through Q-Wall proxy |
| CCS attendance and chair usage | SQL Server through Q-Wall proxy |
| Q-Wall lot sampling | SQL Server |
| Plex production, BOM, demand, maintenance source data | Plex through Plex proxy |
| Incoming Inspection interactive snapshot | PostgreSQL synchronized from Plex |
| COGP | Mixed: live Plex calculations and PostgreSQL synchronized state |
| Action Tracker open-action references | SQL Server integration through Q-Wall proxy |
