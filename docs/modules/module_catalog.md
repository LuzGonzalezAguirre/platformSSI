# PlatformSSI Module Catalog

## 1. Purpose

This document records the functional modules currently represented in the repository and distinguishes between implemented application areas, partial modules and placeholders.

The catalog is based on Django application registration, backend URL configuration, frontend route configuration and repository structure.

## 2. Backend domain catalog

| Backend application | Runtime registration | API registration | Current state |
|---|---|---|---|
| core | Yes | No functional root route | Structural and shared namespace, minimal implementation |
| identity | Yes | api/v1/auth | Implemented |
| permissions | Yes | api/v1/permissions | Implemented |
| audit | Yes | api/v1/audit | Implemented |
| manufacturing | Yes | api/v1/manufacturing | Present with minimal implementation |
| maintenance | Yes | api/v1/maintenance | Implemented |
| analytics | Yes | api/v1/analytics | Present with minimal implementation |
| integrations | Yes | No direct root route | Structural integration namespace |
| warehouse | Yes | api/v1/warehouse | Implemented |
| production | Yes | api/v1/production | Implemented |
| quality | Yes | api/v1/quality | Implemented and extensive |
| notifications | Yes | api/v1/notifications | Implemented |
| ssi_common | Not present in LOCAL_APPS list reviewed | api/v1/common | Repository module connected through URLs; runtime registration requires further verification |
| ssi_attendance | No in LOCAL_APPS list reviewed | No root API registration reviewed | Present in repository |
| ssi_chairs | No in LOCAL_APPS list reviewed | No root API registration reviewed | Present in repository |

## 3. Frontend route catalog

| Functional area | Route examples | Current state |
|---|---|---|
| Home | / | Implemented authenticated landing page |
| Production | /production/ops-daily-report, /production/targets, /production/safety, /production/assistance, /production/leysilla | Implemented |
| Maintenance | /maintenance/overview, /maintenance/work-requests, /maintenance/pmp, /maintenance/down-equipment, /maintenance/corrective-actions | Implemented |
| Quality | /quality/dashboard, /quality/qwall, /quality/qwall-dashboard, /quality/rejections, /quality/downtime, /quality/cogp, /quality/scrap-rate | Implemented |
| Problem Control | /quality/problems and related detail, edit and approval routes | Implemented |
| Q-Wall configuration | /quality/qwall/settings | Implemented |
| Incoming inspection | /quality/incoming-inspection | Implemented |
| Warehouse | /warehouse/ctb, /warehouse/demand | Implemented |
| Administration | /settings/users, /settings/roles, /settings/audit | Implemented |
| Profile | /profile | Implemented |
| Maintenance orders | /maintenance/orders | Placeholder |
| Maintenance actions | /maintenance/actions | Placeholder |
| Workcenter detail | /maintenance/workcenter | Placeholder |
| Plant settings | /settings/plant | Placeholder |
| General settings | /settings | Placeholder |

## 4. Production backend capabilities

The production URL surface includes business units, weekly targets, weekly WIP, safety settings, safety incidents, plant employee management, attendance, earned hours, OEE records, OPS daily summary, OPS weekly tables, daily exports, PDF exports, CCS attendance, CCS employees, chair metrics and daily productivity.

## 5. Maintenance backend capabilities

The maintenance URL surface includes overview KPIs, maintenance reasons, detail data, OEE trends, downtime by month, live OEE, dashboard targets, work-request dashboard data, down-equipment dashboard data, corrective-action management, corrective-action comments, corrective-action metrics, equipment catalogs, assignee catalogs and PMP calendar data.

## 6. Quality backend capabilities

The quality URL surface includes chatbot routes, scrap detail, quality targets, Q-Wall reporting and analytics, rejection reporting, Problem Control, attachments, notes, failure catalogs, scan rules, Q-Wall settings, incoming inspection, downtime and COGP.

Quality also contains configurable Problem Control catalogs for severity levels, defect types, problem categories and problem types.

## 7. Warehouse backend capabilities

Warehouse exposes part revisions, BOM hierarchy, clear-to-build related BOM information and demand.

## 8. Notification capabilities

The notification API supports retrieval, marking all notifications as read and marking individual notifications as read.

## 9. Documentation status classification

Implemented means there is an active route or backend API surface with supporting source code in the repository.

Partial means the namespace or module exists but is not yet represented as a complete functional area.

Placeholder means the frontend route exists and renders placeholder content rather than a completed module.

Presence in repository means source code exists but current Django application registration or API wiring was not confirmed in the reviewed configuration.

This classification will be refined as the documentation process continues into models, services, repositories, tasks, SQL objects and integration-specific code.
