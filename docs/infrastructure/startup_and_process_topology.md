# Startup and Process Topology

## 1. Scope

PlatformSSI is not started exclusively through Docker Compose. The repository contains Windows host scripts that coordinate Docker application services with two proxy processes running directly on the host.

This document records the startup behavior represented by those scripts.

## 2. Platform startup orchestration

The startapp/platformSSI.bat repository file contains PowerShell here-string content that writes a generated Windows batch file named start_platform.bat.

The generated startup flow performs the following operations in sequence.

Docker availability is checked.

Docker Desktop is started when Docker is not responding.

The Plex ODBC proxy startup script is launched.

The Q-Wall SQL proxy startup script is launched.

PlatformSSI application services are force-recreated with Docker Compose.

The Celery worker is checked to verify that PLEX_PROXY_SECRET is present.

Django migrations are executed inside the backend container.

A network access address for the frontend is displayed.

The use of force-recreate is intentional in the script so changed environment values are applied to backend, Celery worker, Celery Beat and frontend containers.

## 3. Plex proxy process

The generated Plex proxy script changes to an external plex-proxy working directory and starts Uvicorn with main:app.

The proxy binds to all interfaces on port 8001 with one worker.

The process is wrapped in an infinite restart loop. When the proxy exits, the script waits five seconds and starts it again.

The Plex proxy source itself is outside the PlatformSSI repository.

## 4. Q-Wall proxy process

The generated Q-Wall proxy script changes to apps/qwall-proxy and starts Uvicorn with main:app.

The proxy binds to all interfaces on port 8002 with one worker.

The process is also wrapped in an infinite restart loop with a five-second restart delay.

Unlike the Plex proxy, the Q-Wall proxy source is contained in the PlatformSSI repository.

## 5. Docker application processes

The startup script force-recreates the following application services.

backend

celery_worker

celery_beat

frontend

PostgreSQL and Redis are not included in that explicit force-recreate command. Their lifecycle is managed through the Docker Compose project and dependency state.

## 6. Migration behavior

The startup flow runs python manage.py migrate through docker compose exec after application services are recreated.

Startup is treated as failed if migrations return a non-zero exit code.

## 7. Incoming Inspection startup validation

The generated startup script explicitly validates that PLEX_PROXY_SECRET exists inside the Celery worker environment.

The comment in the script identifies Incoming Inspection as dependent on this secret in Celery.

Startup is stopped when the variable is unavailable.

## 8. Process supervision model

The proxy processes use Windows command-shell loops for restart behavior.

Docker services use restart: unless-stopped.

This creates two supervision mechanisms in the current deployment model.

| Process family | Supervision |
|---|---|
| PostgreSQL, Redis, Django, Celery, frontend | Docker restart policy |
| Plex proxy, Q-Wall proxy | Windows loop around Uvicorn |

## 9. Development versus production characteristics

The backend container starts Django with manage.py runserver.

The frontend container starts the Vite development server.

The Docker Compose file uses the development Django settings module.

The repository has production-specific Python dependencies, but the active composition reviewed here remains development-oriented.

## 10. Operational dependency chain

A simplified startup dependency chain is represented as follows.

Windows host

Docker Desktop

PostgreSQL and Redis

Plex proxy on host port 8001

Q-Wall proxy on host port 8002

Django backend

Celery worker

Celery Beat

React Vite frontend

Django migrations and Celery environment validation occur as explicit startup checks after the application containers are recreated.

## 11. Repository limitation

The exact Windows Task Scheduler, service account, login policy or boot-time invocation mechanism used to start the orchestration script is not determined from this repository.

Those details require host-level operational verification.
