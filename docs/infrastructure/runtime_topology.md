# Runtime and Infrastructure Topology

## 1. Docker composition

The repository defines a Docker Compose development environment with six services.

| Service | Container name | Exposed port | Purpose |
|---|---|---|---|
| db | mes_postgres | 5432 | PostgreSQL database |
| redis | mes_redis | 6379 | Cache and Celery broker |
| backend | mes_backend | 8000 | Django development server |
| celery_worker | mes_celery_worker | none | Background task execution |
| celery_beat | mes_celery_beat | none | Scheduled task dispatch |
| frontend | mes_frontend | 5173 | Vite development server |

## 2. PostgreSQL

The development composition uses postgres:16-alpine.

A persistent Docker volume named postgres_data stores database files.

The database container includes a pg_isready health check.

The database credentials currently appear directly in the Docker development configuration. Secret values are not repeated in this document.

## 3. Redis

The development composition uses redis:7-alpine.

Redis persistence is mapped through the redis_data Docker volume.

The server is configured with authentication, a 512 MB maximum-memory setting and allkeys-lru eviction.

Redis is used by PlatformSSI for at least two distinct responsibilities.

Django cache backend

Celery message broker

This shared use should be considered when analyzing memory usage, eviction behavior and future cache isolation.

## 4. Django backend

The backend container builds from apps/backend/Dockerfile.dev.

The development command runs the Django development server on 0.0.0.0 port 8000.

The backend source directory is bind-mounted into the container.

The backend waits for PostgreSQL and Redis health checks before startup.

## 5. Celery worker

The Celery worker uses the same backend image and source volume.

The current worker command uses a concurrency value of 4.

The worker depends on backend startup.

## 6. Celery Beat

Celery Beat uses the same backend image and source volume.

It uses django_celery_beat.schedulers:DatabaseScheduler.

The service depends on backend and celery_worker.

## 7. Frontend

The frontend container builds from apps/frontend/Dockerfile.dev.

The frontend source is bind-mounted and node_modules is retained in a container path.

The development API base URL is set to the Django API on localhost port 8000 under api/v1.

## 8. External local processes

The Docker backend configuration points to two services through host.docker.internal.

| Service | Address represented in configuration |
|---|---|
| Plex proxy | host.docker.internal:8001 |
| Q-Wall proxy | host.docker.internal:8002 |

These services are not started by the current Docker Compose file.

The repository contains Q-Wall proxy source under apps/qwall-proxy. The Plex proxy implementation is not present in this repository state.

## 9. Windows startup assets

The startapp directory contains Windows batch files for PlatformSSI startup, Plex proxy startup and Q-Wall proxy startup.

These scripts indicate that part of the operational runtime is expected to execute directly on a Windows host rather than exclusively inside Docker.

A separate operational document should record the exact deployed host topology after it is verified against the real environment.

## 10. Environment configuration

The backend runtime uses environment variables for database connection, Redis, Plex proxy, Q-Wall proxy and Action Tracker integration.

The current Docker development configuration also contains secret values directly in docker-compose.yml.

This documentation records the existence of that configuration risk but does not reproduce the values.

## 11. Health behavior

PostgreSQL and Redis have explicit Docker health checks.

The reviewed composition does not define application-level Docker health checks for Django, Celery, the frontend or external proxy dependencies.

Application dependency health therefore cannot currently be inferred from Docker service state alone.

## 12. Deployment boundary

The current docker-compose.yml is development-oriented. The backend uses runserver, the frontend uses Vite development behavior and the Django development settings allow permissive hosts and CORS.

A production runtime topology cannot be considered fully documented until the production host configuration, reverse proxy behavior, TLS termination, process supervision, backup policy and secret management are verified outside this repository.
