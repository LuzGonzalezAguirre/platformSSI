# Backend Architecture

## 1. Technology baseline

The PlatformSSI backend is implemented with Django 5.1.4 and Django REST Framework 3.15.2.

The backend dependency set includes PostgreSQL support, Redis, Celery, JWT authentication, ODBC connectivity, SQL Server connectivity, HTTP clients, PDF generation and spreadsheet generation.

| Capability | Primary dependency |
|---|---|
| Web framework | Django 5.1.4 |
| REST API | Django REST Framework 3.15.2 |
| JWT authentication | djangorestframework-simplejwt 5.3.1 |
| PostgreSQL | psycopg2-binary 2.9.10 |
| Redis integration | django-redis 5.4.0 and redis 5.2.1 |
| Background processing | Celery 5.4.0 |
| Scheduling | django-celery-beat 2.7.0 |
| Task result persistence | django-celery-results 2.5.1 |
| ODBC | pyodbc 5.2.0 |
| SQL Server alternative driver | pymssql 2.3.13 |
| HTTP | httpx 0.27.2 and requests |
| Spreadsheet output | openpyxl |
| PDF and document output | WeasyPrint, ReportLab and Pillow |

## 2. Django applications

The installed local applications are core, identity, permissions, audit, manufacturing, maintenance, analytics, integrations, warehouse, production, quality and notifications.

Additional packages ssi_attendance, ssi_chairs and ssi_common are also present in the repository. ssi_common is connected to the root API URL configuration. The current base settings list does not include ssi_attendance or ssi_chairs as installed applications.

This distinction is significant because repository presence does not necessarily mean Django runtime registration.

## 3. Middleware

The middleware chain includes Django security, CORS, sessions, locale handling, common middleware, CSRF protection, authentication, messages, clickjacking protection and a custom AuditMiddleware.

The audit middleware means request-level activity can be recorded centrally rather than only inside individual module views.

## 4. REST defaults

The REST API uses JWT authentication by default.

All endpoints inherit IsAuthenticated unless a view overrides that policy.

Pagination uses page-number pagination with a default page size of 50.

The default renderer is JSONRenderer.

## 5. Identity API

The identity module exposes authentication, profile and user-management functions.

| Endpoint group | Capability |
|---|---|
| login, logout, refresh, me | Session identity through JWT |
| me/update | Profile update |
| me/change-password | Password change |
| me/avatar | Avatar upload |
| users | User listing and creation |
| users/{id} | User detail |
| users/{id}/toggle-active | Active-state change |
| users/{id}/reset-password | Password reset |
| roles | Role choices |

## 6. Permission API

The permissions module exposes permission choices, role management, per-user permission management and current-user permission retrieval.

This separates identity from authorization configuration.

## 7. Production API

The production module currently includes business units, weekly targets, weekly WIP, safety settings and incidents, plant employees, attendance, earned hours, OEE records, OPS daily reporting, exports, CCS attendance, employee data, chair-control metrics and daily productivity.

The module therefore combines direct PlatformSSI production functions with data obtained through CCS-oriented views.

## 8. Maintenance API

The maintenance module currently provides overview KPIs, reason analysis, detail data, OEE trend, downtime by month, live OEE, targets, work-request dashboard data, down-equipment dashboard data, corrective actions, corrective-action comments, corrective-action metrics, equipment catalogs, assignee catalogs and PMP calendar data.

## 9. Quality API

Quality is the broadest backend domain in the current route surface.

It contains Q-Wall reporting, Q-Wall trends, Pareto analysis, fail-by-point analysis, business-unit summaries, part-number summaries, rejection reporting, Problem Control workflows, configurable quality catalogs, attachments, notes, downtime, COGP, scan rules, incoming inspection and Q-Wall settings.

Problem Control contains dedicated routes for submission, approval, department approval, final approval assignments, rejection, closure and override workflows.

## 10. Warehouse API

The warehouse module exposes part revisions, BOM hierarchy, BOM clear-to-build data and demand.

The public API contract uses part number and revision path parameters for BOM-related operations.

## 11. Notifications API

The notifications module exposes notification listing, mark-all-read and mark-individual-read operations.

## 12. Caching

Django uses Redis through django-redis in development.

The cache location is configured through REDIS_URL and the development key prefix is mes_dev.

A PLEX_CACHE_TTL setting exists with a value of 300 seconds.

The repository currently does not define a single generalized cache abstraction in the main configuration. Cache behavior therefore must be documented at the module or service level wherever specific cache calls are implemented.

## 13. Celery

Celery is initialized in config/celery.py and discovers tasks from installed applications.

Task tracking is enabled. The task time limit is 30 minutes.

Task results are persisted through django-celery-results.

The broker uses the same Redis endpoint configured for Django cache in the development environment.

Celery Beat uses database-backed scheduling.

## 14. Logging

Development logging is currently console-based with the root log level set to DEBUG.

The current settings do not define structured JSON logging, request correlation identifiers or centralized log transport.

These capabilities therefore belong to future architecture work and should not be represented as existing behavior.

## 15. Configuration and security observations

The development settings enable DEBUG, allow all hosts and allow all CORS origins.

The docker-compose file contains development database credentials and integration secret values directly in configuration. Those values are intentionally not reproduced in this documentation.

The current repository should be treated as containing development-oriented configuration. The presence of a production requirements file does not by itself establish a complete production configuration profile.
