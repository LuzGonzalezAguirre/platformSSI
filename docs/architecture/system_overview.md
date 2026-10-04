# PlatformSSI System Overview

## 1. System definition

PlatformSSI is a modular web platform composed of a Django REST backend and a React TypeScript frontend. The backend coordinates application rules, persistent data, cache access, scheduled work and integrations with external data sources. The frontend provides authenticated navigation and functional modules for production, quality, maintenance, warehouse and administration.

The current repository also contains an independent Q-Wall proxy component used to communicate with SQL Server based Q-Wall data and supporting lot inspection functionality.

## 2. Primary runtime components

| Component | Technology | Primary responsibility |
|---|---|---|
| Frontend | React 18, TypeScript, Vite | User interface, routing, client state and API consumption |
| Backend | Django 5.1.4, Django REST Framework 3.15.2 | REST API, business rules, authentication, authorization and orchestration |
| Primary database | PostgreSQL 16 | Persistent application data |
| Cache and broker | Redis 7 | Django cache backend and Celery broker |
| Background worker | Celery 5.4 | Asynchronous and scheduled application work |
| Scheduler | Celery Beat with django-celery-beat | Periodic task execution |
| Q-Wall proxy | Python service | SQL Server integration for Q-Wall related functions |
| Plex proxy | External process referenced by configuration | Plex data access through a local proxy endpoint |

## 3. Runtime topology

The development composition defines PostgreSQL, Redis, Django, Celery Worker, Celery Beat and React as separate services.

The backend is exposed on port 8000. The frontend is exposed on port 5173. PostgreSQL is mapped to port 5432 and Redis to port 6379.

The backend references a Plex proxy at host.docker.internal port 8001 and a Q-Wall proxy at host.docker.internal port 8002. These proxy processes are not defined as services in the current docker-compose file and therefore exist outside the Docker composition represented in the repository.

## 4. Application request flow

A normal authenticated application request follows the general sequence below.

Client browser

React application

HTTP request to api/v1

Django REST endpoint

Application view and service or repository logic where implemented

PostgreSQL, Redis or external integration

JSON response

React Query or module-specific client code

Rendered user interface

The precise flow varies by module. Some modules use local PostgreSQL models while others obtain data through integration clients and proxy services.

## 5. API organization

The backend exposes versioned routes under api/v1.

| API prefix | Backend module |
|---|---|
| api/v1/auth | identity |
| api/v1/permissions | permissions |
| api/v1/manufacturing | manufacturing |
| api/v1/maintenance | maintenance |
| api/v1/analytics | analytics |
| api/v1/warehouse | warehouse |
| api/v1/production | production |
| api/v1/quality | quality |
| api/v1/audit | audit |
| api/v1/notifications | notifications |
| api/v1/common | ssi_common |

The maintenance route is currently registered twice in the root URL configuration. Both registrations resolve to the same module and should be treated as an implementation duplication rather than two independent APIs.

## 6. Authentication and authorization

The backend uses JSON Web Tokens through djangorestframework-simplejwt.

Access tokens have a configured lifetime of 60 minutes. Refresh tokens have a configured lifetime of 7 days. Refresh token rotation and blacklisting are enabled.

The custom user model is identity.User. The JWT user identifier is employee_id.

Django REST Framework applies IsAuthenticated as the default permission policy. Module-level role and permission behavior is implemented separately through the identity and permissions applications.

## 7. Caching and asynchronous processing

Redis is configured as the Django cache backend. The development key prefix is mes_dev.

Redis is also configured as the Celery broker.

Celery stores task results through django-celery-results and uses django-celery-beat for database-backed scheduling.

The base settings currently define a Plex cache time-to-live value of 300 seconds. The repository does not yet expose a unified cache policy layer at the global architecture level.

## 8. Scheduled tasks

Two recurring Saturday tasks are configured in the base settings.

| Task | Schedule | Purpose from task name |
|---|---|---|
| apps.quality.cogp.tasks.stage_weekly_cogp_offenders | Saturday 07:00 | Stage weekly COGP offenders |
| apps.maintenance.tasks.stage_weekly_maintenance_offenders_task | Saturday 07:15 | Stage weekly maintenance offenders |

The scheduler timezone is America/Monterrey.

## 9. External dependencies

The repository configuration references external dependencies that are not fully contained in the Docker composition.

| Dependency | Interface represented in repository |
|---|---|
| Plex | HTTP proxy configured through PLEX_PROXY_URL |
| Q-Wall and CCS data | HTTP proxy configured through QWALL_PROXY_URL and SQL Server connection references |
| Action Tracker | URL and bot credential configuration variables |
| SQL Server | pyodbc and pymssql dependencies are present |

The complete deployment topology of these external systems cannot be determined exclusively from this repository.

## 10. Current architectural characteristics

PlatformSSI is currently a modular monolithic web application with auxiliary proxy processes and background workers. It is not represented in the repository as a microservice architecture.

Backend responsibilities are divided by Django application domain. Frontend responsibilities are divided primarily by functional module.

Several backend applications already contain folders named models, repositories, serializers, services, tests and views, although the degree of implementation differs by module. This indicates an intended layered organization, but the current codebase contains both layered modules and modules where logic remains concentrated in view or integration files.

## 11. Current-state boundary

This document describes the implemented architecture only. Future additions such as generalized cache policy, distributed tracing, Redis Streams, circuit breakers, standardized retries, event contracts, dead-letter queues and advanced observability are not part of the current architecture unless specifically implemented in source code.
