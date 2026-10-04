# External Integrations

## 1. Integration boundary

PlatformSSI communicates with external operational data through local proxy services and HTTP clients. The repository currently represents three primary external integration boundaries.

Plex

Q-Wall and CCS SQL Server

Action Tracker data exposed through SQL Server and proxy endpoints

## 2. Plex integration

The Django backend does not connect directly to Plex through ODBC in the reviewed repository.

Backend modules use a Plex proxy address configured through PLEX_PROXY_URL and authenticate requests with PLEX_PROXY_SECRET.

The default proxy address points to host.docker.internal port 8001.

Warehouse defines a PlexClient responsible for part revisions, BOM hierarchy, BOM clear-to-build and demand.

Quality defines QualityPlexClient for scrap detail, COGP cost models, customer-part mapping, scrap data and production data.

Maintenance and production services also issue HTTP requests to the Plex proxy for operational calculations.

The shared helper apps.ssi_common.plex_ranges defines range chunking behavior used by modules that must split larger date ranges.

## 3. Plex error boundary

The warehouse Plex client defines PlexProxyError for proxy communication failures.

Quality and COGP services reuse the Plex client abstraction and explicitly avoid converting certain malformed or incomplete Plex results into apparently valid zero-valued cache entries.

HTTP timeout and HTTP status failures are handled at client or service level rather than through a central retry or circuit-breaker layer.

## 4. Q-Wall and CCS integration

Q-Wall and CCS access is represented by apps/qwall-proxy.

The Django backend references the proxy through QWALL_PROXY_URL and QWALL_PROXY_TOKEN.

The default address points to host.docker.internal port 8002.

The proxy contains FastAPI-style routes and direct SQL Server queries.

## 5. Q-Wall proxy functional surface

Confirmed proxy functions include inspection retrieval, inspection-point failures, rejection reports, rejection photos, part-number catalogs, piece flags, attendance, employees, chair usage, Q-Wall configuration catalogs, failure modes, inspection points, system configuration, offender staging, Action Tracker open actions, lot-sampling configuration and scan-rule management.

The proxy uses token verification on protected routes.

## 6. SQL Server objects referenced by Q-Wall proxy

The proxy references operational tables including the following families.

| Area | Referenced objects |
|---|---|
| Inspection | ssi_Inspections, ssi_InspectionResults, ssi_ResultFailModes |
| Catalog | ssi_InspectionPoints, ssi_FailModes, ssi_InspectionPointFailModes |
| Product | ssi_Products, ssi_PartNumbers, ssi_BusinessUnits |
| Users | ssi_Users, ssi_Roles |
| Quality media | ssi_RejectionPhotos |
| Piece flags | ssi_PieceFlagRecords |
| Attendance | ssi_Attendance, ssi_production_employee |
| Chair control | ssi_ChairUsage |
| Configuration | ssi_SystemConfig |
| Action integration | ssi_ScrapOffenderActions, ssi_MaintenanceOffenderActions, ssi_AT_items, ssi_AT_estados |
| Lot sampling | ssi_QWallLotSettings, ssi_QWallLotModelSettings, ssi_QWallSamplingMatrix |

The physical schema includes dbo-qualified objects in several integration paths.

## 7. SQL Server stored procedures referenced by proxy

The attendance integration invokes stored procedures including sp_RegisterCheckIn, sp_RegisterCheckOut, sp_RegisterOvertime and sp_GetAttendanceSummary.

Additional stored procedures may exist outside the repository and must be added after database-level verification.

## 8. Q-Wall lot sampling

The repository contains scripts/sql/ssi_QWallLotSampling.sql.

The script creates SQL Server tables for general lot configuration, model-specific lot configuration and sampling matrix values.

The Django migration history confirms that an earlier PostgreSQL representation was removed.

Current Q-Wall lot-sampling configuration should therefore be treated as SQL Server-owned operational configuration accessed through the Q-Wall proxy.

## 9. Scan rules

The Q-Wall proxy includes a separate scan_rules_router.py.

The route surface supports listing, creation, retrieval, update, deletion and active-state toggling of scan rules.

The rule payload includes part-number and business-unit information together with additional scan behavior represented by the router schema.

## 10. Action Tracker integration

PlatformSSI contains Action Tracker integration at multiple levels.

The backend configuration exposes ACTION_TRACKER_URL and bot credential variables.

The ssi_common.action_tracker_actions module retrieves open actions through the Q-Wall proxy rather than connecting directly to Action Tracker storage.

Work Requests attaches live open Action Tracker links outside its cached Plex result.

COGP offender processing stages records through the Q-Wall proxy endpoint scrap-offenders/stage.

Maintenance offender processing uses a corresponding maintenance-offenders staging path.

The proxy joins offender staging records with Action Tracker SQL tables when resolving open actions.

## 11. Integration authentication

Plex requests use a shared proxy secret configured in the backend environment.

Q-Wall proxy requests use a configured proxy token.

Action Tracker bot credentials are represented as environment configuration.

Secret values currently appear in development composition files. This document intentionally omits all secret values.

## 12. Integration resilience

Current integration resilience is implemented locally.

Examples include HTTP timeouts, selected retries, Celery retry policies, range chunking and cache fallback behavior.

A central circuit-breaker policy, central retry policy, dependency health model and unified correlation identifier are not established at platform level in the reviewed source.

## 13. Source-of-truth distinction

Plex remains the source for ERP and production-oriented records retrieved through its proxy unless data has been explicitly synchronized into PostgreSQL.

SQL Server remains the source for Q-Wall and CCS operational records accessed through the Q-Wall proxy.

PostgreSQL remains the PlatformSSI application database for Django-owned state.

Action Tracker state is not represented as PlatformSSI-owned PostgreSQL data in the reviewed integration path.
