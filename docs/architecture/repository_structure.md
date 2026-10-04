# Repository Structure

## 1. Root organization

The repository is organized around application source code, infrastructure configuration, SQL assets, operational scripts and technical documentation.

| Path | Responsibility |
|---|---|
| apps/backend | Django backend |
| apps/frontend | React TypeScript frontend |
| apps/qwall-proxy | Q-Wall SQL Server proxy and related logic |
| docs | Technical documentation |
| ops/db | Operational database scripts |
| scripts/sql | SQL schema and support scripts |
| startapp | Windows startup scripts |
| docker-compose.yml | Development runtime composition |
| chatbot_questions_fixture.json | Chatbot question fixture data |

## 2. Backend structure

The backend is located under apps/backend.

The configuration package contains Django settings, root URLs, WSGI configuration and Celery initialization.

The application package contains the following Django domain applications.

| Application | Current repository role |
|---|---|
| analytics | Analytics namespace with minimal current implementation |
| audit | Request and activity auditing |
| core | Shared core namespace with minimal current implementation |
| identity | User identity, authentication and profile functions |
| integrations | Integration namespace with minimal current implementation |
| maintenance | Maintenance dashboards, work requests, corrective actions, PMP and down equipment |
| manufacturing | Manufacturing namespace with minimal current implementation |
| notifications | In-application notification endpoints |
| permissions | Role and permission management |
| production | Production targets, safety, attendance, CCS attendance, chair analytics, OPS reporting and productivity |
| quality | Quality dashboards, Q-Wall, Problem Control, downtime, COGP, incoming inspection and related catalogs |
| ssi_attendance | Additional SSI attendance application present in repository |
| ssi_chairs | Additional chair-control application present in repository |
| ssi_common | Shared SSI-specific API functions |
| warehouse | BOM, clear-to-build related backend functions and demand |

The applications analytics, core, integrations and manufacturing currently contain substantial empty package structure. Their presence is documented because they form part of the repository, but they should not be described as fully implemented functional domains.

## 3. Backend configuration structure

The settings are separated into base and development configuration.

The base settings define installed applications, middleware, REST framework behavior, JWT configuration, external integration addresses, Celery behavior and scheduled tasks.

The development settings define PostgreSQL, Redis cache, Celery broker, permissive CORS behavior and console logging.

No production settings module is present in the current config/settings directory. A production requirements file exists, but the repository state reviewed for this documentation contains only base.py and development.py under Django settings.

## 4. Frontend structure

The frontend is located under apps/frontend.

The main application uses React Router for navigation, TanStack React Query for server-state handling and Zustand for authentication state.

The modules directory currently contains the following functional areas.

| Module | Responsibility represented in frontend |
|---|---|
| admin | User, role and audit administration |
| auth | Login |
| incoming-inspection | Incoming inspection |
| maintenance | Maintenance views |
| notifications | Notification interface |
| operational-panel | Operational panel |
| production | Production dashboards and operational reporting |
| profile | User profile |
| quality | Quality dashboards, Q-Wall, COGP, downtime and Problem Control |
| qwall-settings | Q-Wall configuration |
| ssi | SSI-specific attendance, chair control and safe launch components |
| warehouse | BOM, clear-to-build and demand views |

The App.tsx router also contains placeholder routes for some maintenance and settings views. These placeholders are part of the current state and are not considered implemented modules.

## 5. Frontend shared areas

The frontend includes shared component, internationalization, library, navigation, service, store and style directories.

Navigation access is role-aware. The sidebar currently defines the roles operador, tecnico, lider, supervisor, ingeniero, admin and gerente.

Administrative navigation is restricted to admin. Q-Wall settings are restricted in the sidebar to admin and ingeniero. Other module availability is generally broader and must be interpreted together with backend permissions.

## 6. Q-Wall proxy

The apps/qwall-proxy directory contains a large main.py implementation, a scan_rules_router.py module and tests for lot sampling.

This proxy is a separate process from the Django backend. The Docker composition references its expected HTTP address but does not start it as a Docker service.

## 7. Database and operational assets

The repository contains SQL scripts for Q-Wall lot sampling and maintenance offender actions.

The ops/db directory contains reconciliation SQL intended for operational database use.

These scripts are part of the technical system and must be documented together with the application code because they define database objects and operational behavior not expressed through Django migrations.

## 8. Existing documentation

The repository already contains qwall-lot-sampling.md and a test file under docs/architecture.

The new technical documentation is intended to consolidate system-wide knowledge without removing existing specialized documentation until its content has been reviewed and either incorporated or explicitly retained.
