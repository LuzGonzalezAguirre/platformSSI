# Maintenance Module

## 1. Scope

The Maintenance domain provides plant maintenance KPIs, downtime analysis, OEE views, work-request analysis, equipment-down monitoring, preventive-maintenance calendar data, corrective actions and weekly maintenance offender staging.

The module combines Plex-derived operational information with PlatformSSI-owned configuration and corrective-action records.

## 2. Persistent entities

Maintenance owns CorrectiveAction, CorrectiveActionComment, CorrectiveActionHistory and MaintenanceDashboardTarget.

Corrective actions store equipment, priority, root cause, failure type, action description, assignment, due date, closure state and status.

CorrectiveActionHistory stores selected field changes.

MaintenanceDashboardTarget stores configurable metric targets and comparison behavior.

## 3. Maintenance overview

MaintenanceService retrieves and transforms Plex proxy information for the maintenance dashboard.

Confirmed service operations include KPI calculation, downtime reasons, downtime detail, downtime by month, live OEE and live OEE trend.

The service uses date-range chunking when required by Plex range constraints.

## 4. Maintenance overview cache

The default MaintenanceService cache TTL is 600 seconds.

Selected paths use 300 seconds or 3600 seconds according to the result type.

Cache keys include versioned prefixes such as maint:kpis:v2 and incorporate filter context.

## 5. Work Requests

WorkRequestsService retrieves work-request data through the Plex proxy, applies PlatformSSI filter context and builds dashboard aggregations.

The default cache TTL is 300 seconds.

The service deliberately adds live Action Tracker references after retrieving the cached Plex-derived dashboard result.

This prevents Action Tracker state from remaining stale for the full Plex-data cache interval.

## 6. Down Equipment

DownEquipmentService retrieves current and historical equipment-state information from Plex proxy endpoints.

The service normalizes current and historical records, derives severity from elapsed minutes, filters by business unit and produces trend data.

Current equipment state is cached for 30 seconds.

Historical data is cached for 600 seconds.

The shorter current-state TTL reflects the higher volatility of active equipment status.

## 7. Preventive Maintenance Program

PmpService obtains yearly preventive-maintenance records through the Plex proxy.

The service normalizes status, resolves maintenance business unit, aggregates yearly statistics and produces monthly calendar information.

The module cache TTL is 600 seconds.

## 8. Corrective Actions

CorrectiveActionService provides listing, retrieval, creation, update, deletion and comment creation for PlatformSSI maintenance corrective actions.

Write behavior is protected by a service-level write check.

The API additionally exposes metrics, equipment catalogs and assignee catalogs.

## 9. Weekly maintenance offenders

maintenance_offender_service calculates the last completed workweek, creates deterministic source keys and stages offender payloads through the integration layer.

The scheduled Celery task stage_weekly_maintenance_offenders_task allows two retries with a 600-second delay.

Celery Beat schedules the task for Saturday at 07:15.

The corresponding SQL Server staging table is dbo.ssi_MaintenanceOffenderActions.

## 10. API surface

The Maintenance API provides overview KPI and trend endpoints, target configuration, Work Requests dashboard, Down Equipment dashboard, corrective-action CRUD and comments, catalogs and PMP calendar retrieval.

All reviewed maintenance views require authenticated access.

## 11. Frontend routes

| Route | Function |
|---|---|
| /maintenance/overview | Maintenance overview |
| /maintenance/work-requests | Work Requests |
| /maintenance/pmp | Preventive Maintenance Program |
| /maintenance/down-equipment | Current down equipment |
| /maintenance/corrective-actions | Corrective actions |

The router also contains placeholder routes for maintenance orders, maintenance actions and workcenter detail.

## 12. External dependencies

Plex is the primary source for maintenance operational data.

PostgreSQL owns maintenance corrective actions and dashboard targets.

Redis caches operational calculations.

SQL Server is involved in the maintenance offender staging integration to Action Tracker.
