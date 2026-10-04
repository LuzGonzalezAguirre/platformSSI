# PlatformSSI Technical Documentation

## 1. Purpose

This documentation describes the current technical state of PlatformSSI as implemented in the repository. Its purpose is to provide a single technical reference for architecture, runtime components, application modules, data access, integrations, API surface, asynchronous processing, security controls, deployment configuration and known implementation boundaries.

The documentation is descriptive rather than instructional. It records what exists in the codebase, how the components are related and which responsibilities are assigned to each area of the system.

## 2. Documentation baseline

The baseline documented in this branch corresponds to the repository state on 2026-10-03.

Information is classified according to evidence available in the repository. Behavior confirmed by source code is described as implemented. Functionality represented only by empty modules, placeholders or incomplete routes is identified as partial or reserved. Infrastructure or operational details that cannot be established from repository contents are identified as not determined from the repository.

## 3. System scope

PlatformSSI is organized as a web platform with a Django REST backend, a React and TypeScript frontend, PostgreSQL persistence, Redis cache and broker services, Celery background processing and external integration points exposed through proxy services.

The repository also contains SQL scripts, operational startup scripts, Q-Wall proxy code, scheduled tasks, reporting components, audit functionality, identity and permission management, production modules, maintenance modules, quality modules, warehouse modules and notification functionality.

## 4. Documentation map

| Area | Document | Scope |
|---|---|---|
| Architecture | architecture/system_overview.md | System boundaries, primary components and runtime relationships |
| Architecture | architecture/repository_structure.md | Repository organization and technical responsibility |
| Architecture | architecture/current_cache_architecture.md | Existing cache topology, TTL policies, warming and locking |
| Architecture | architecture/known_implementation_notes.md | Confirmed implementation characteristics and inconsistencies |
| Backend | backend/backend_architecture.md | Django, DRF, middleware, API organization and application layering |
| Backend | backend/background_processing.md | Celery workers, Beat, retries, synchronization and scheduled work |
| Frontend | frontend/frontend_architecture.md | React, routing, state, navigation and current module surface |
| API | api/api_catalog.md | Versioned REST route and HTTP method catalog |
| Data | data/data_model_catalog.md | PlatformSSI PostgreSQL entity catalog |
| Data | data/data_flows.md | End-to-end request, cache, proxy and persistence flows |
| Data | data/sql_assets.md | Direct PostgreSQL reconciliation and SQL Server assets |
| Integrations | integrations/external_integrations.md | Plex, Q-Wall, CCS and Action Tracker boundaries |
| Infrastructure | infrastructure/runtime_topology.md | Docker services, ports and external process dependencies |
| Infrastructure | infrastructure/startup_and_process_topology.md | Windows orchestration, proxy processes and startup checks |
| Configuration | configuration/configuration_reference.md | Settings profiles, environment variables and runtime configuration |
| Security | security/authentication_authorization.md | JWT, roles, permissions, proxy authentication and audit boundary |
| Observability | observability/current_observability.md | Logging, audit, task state and health mechanisms currently present |
| Testing | testing/test_inventory.md | Current automated test inventory and coverage boundary |
| Modules | modules/module_catalog.md | Functional module inventory and implementation state |
| Modules | modules/production.md | Production domain |
| Modules | modules/maintenance.md | Maintenance domain |
| Modules | modules/quality.md | Quality domain overview |
| Modules | modules/quality_qwall.md | Q-Wall reporting and configuration |
| Modules | modules/quality_cogp.md | COGP and scrap analytics |
| Modules | modules/quality_incoming_inspection.md | Incoming Inspection |
| Modules | modules/quality_problem_control.md | Problem Control |
| Modules | modules/warehouse.md | Warehouse and Plex-backed BOM/demand functions |
| Modules | modules/identity_permissions_notifications_audit.md | Platform control and cross-cutting modules |
| Reference | reference/source_file_inventory.md | Complete 627-file baseline repository inventory |

## 5. Documentation principles

The source repository is the primary source of truth for this documentation.

Credentials and secret values are never reproduced in documentation even when they currently exist in configuration files.

The documentation distinguishes between implemented functionality, partial implementation, placeholders and planned structure.

Historical database objects are distinguished from current operational ownership.

External-source data is distinguished from PlatformSSI-owned persisted state.

Architectural recommendations and future-state proposals are intentionally excluded from the current-state documentation. Those decisions belong in separate target-architecture and architecture-decision records so that the current implementation is not confused with planned changes.

## 6. Current documentation phase

The documents in this branch establish the system-wide current-state baseline and the primary domain descriptions.

Additional detailed reference work can continue at serializer, request-schema, response-schema, query-parameter, frontend component and physical database-schema level where required. Those details should extend this baseline rather than replace it.
