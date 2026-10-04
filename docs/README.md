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

## 4. Documentation structure

| Area | Document | Scope |
|---|---|---|
| Architecture | architecture/system_overview.md | System boundaries, primary components and runtime relationships |
| Architecture | architecture/repository_structure.md | Repository layout and ownership of technical responsibilities |
| Backend | backend/backend_architecture.md | Django, DRF, authentication, modules, API organization and background processing |
| Frontend | frontend/frontend_architecture.md | React application, routing, state, data fetching and user-facing modules |
| Infrastructure | infrastructure/runtime_topology.md | Containers, ports, Redis, PostgreSQL, Celery and external service dependencies |
| Modules | modules/module_catalog.md | Backend and frontend module inventory with current implementation state |

## 5. Documentation principles

The source repository is the primary source of truth for this documentation.

Credentials and secret values are never reproduced in documentation even when they currently exist in configuration files.

The documentation distinguishes between implemented functionality, partial implementation, placeholders and planned structure.

Architectural recommendations and future-state proposals are intentionally excluded from the current-state documentation. Those decisions belong in separate target-architecture and architecture-decision records so that the current implementation is not confused with planned changes.
