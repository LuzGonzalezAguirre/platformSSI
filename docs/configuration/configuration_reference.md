# PlatformSSI Configuration Reference

## 1. Scope

This document records configuration points confirmed in the repository. Secret values are intentionally excluded.

The current configuration is development-oriented and is split between Django settings, Docker Compose environment variables, frontend environment variables and direct defaults inside selected integration modules.

## 2. Django settings profiles

The repository contains config/settings/base.py and config/settings/development.py.

No production.py settings module is present in the reviewed config/settings directory.

The repository does contain requirements/production.txt, which defines production-oriented Python packages, but this is not equivalent to a production Django settings profile.

## 3. Core Django configuration

| Setting | Current behavior |
|---|---|
| AUTH_USER_MODEL | identity.User |
| LANGUAGE_CODE | en-us |
| USE_I18N | True |
| USE_TZ | True |
| TIME_ZONE | America/Monterrey |
| STATIC_URL | /static/ |
| MEDIA_URL | /media/ |
| REST page size | 50 |
| REST renderer | JSON |
| REST authentication | JWT |
| REST default permission | IsAuthenticated |

Supported application languages are English and Spanish.

## 4. JWT configuration

| Setting | Value |
|---|---|
| Access token lifetime | 60 minutes |
| Refresh token lifetime | 7 days |
| Refresh rotation | Enabled |
| Refresh blacklist after rotation | Enabled |
| Authorization header type | Bearer |
| User identifier field | employee_id |
| User identifier claim | employee_id |

## 5. PostgreSQL configuration

Development PostgreSQL configuration is controlled by the following environment variables.

| Variable | Purpose |
|---|---|
| POSTGRES_DB | Database name |
| POSTGRES_USER | Database user |
| POSTGRES_PASSWORD | Database password |
| DB_HOST | PostgreSQL host |
| DB_PORT | PostgreSQL port |

The development defaults point to the Docker PostgreSQL service.

## 6. Redis configuration

| Variable | Purpose |
|---|---|
| REDIS_URL | Django cache location and Celery broker |

The Django development cache uses key prefix mes_dev.

The Docker Redis service applies authentication, a 512 MB maximum-memory limit and allkeys-lru eviction.

## 7. Plex integration configuration

| Variable or setting | Purpose |
|---|---|
| PLEX_PROXY_URL | Plex proxy base address |
| PLEX_PROXY_SECRET | Shared authentication secret for proxy requests |
| PLEX_CACHE_TTL | Base Plex-related cache TTL setting |

The default proxy address references host.docker.internal on port 8001.

PLEX_CACHE_TTL is configured as 300 seconds in base settings.

Individual modules may override cache behavior with module-specific TTL values.

## 8. Q-Wall and CCS configuration

| Variable or setting | Purpose |
|---|---|
| QWALL_PROXY_URL | Q-Wall proxy base address |
| QWALL_PROXY_TOKEN | Shared authentication token |
| QWALL_DB_CONN_STR | SQL Server connection string represented in development configuration |

The default proxy address references host.docker.internal on port 8002.

Secret and credential values present in source configuration are not reproduced in this document.

## 9. Action Tracker configuration

| Variable | Purpose |
|---|---|
| ACTION_TRACKER_URL | Action Tracker application address |
| ACTION_TRACKER_BOT_USER | Bot account user |
| ACTION_TRACKER_BOT_PASSWORD | Bot account password |

The Docker Compose backend service exposes these variables using environment substitution where configured.

## 10. Celery configuration

| Setting | Current behavior |
|---|---|
| Broker | REDIS_URL |
| Result backend | django-db |
| Cache backend | django-cache |
| Task track started | Enabled |
| Task time limit | 30 minutes |
| Scheduler | django-celery-beat DatabaseScheduler |
| Scheduler timezone | America/Monterrey |
| Development worker concurrency | 4 |

## 11. Frontend configuration

| Variable | Purpose |
|---|---|
| VITE_API_BASE_URL | Base URL used for backend API requests |

The Docker development composition configures the frontend to use the Django API under localhost port 8000 and api/v1.

## 12. Development security settings

The development profile enables DEBUG.

ALLOWED_HOSTS accepts all hosts.

CORS allows all origins.

These settings describe the current development profile and should not be interpreted as a hardened production policy.

## 13. Python dependency profiles

base.txt contains application runtime dependencies.

development.txt includes base.txt and adds development and test tooling including Django Debug Toolbar, IPython, Factory Boy, Faker, pytest, pytest-django and pytest-cov.

production.txt includes base.txt and adds Gunicorn, WhiteNoise and the Django integration for Sentry SDK.

The presence of Sentry SDK in production requirements does not establish that Sentry is currently configured or active in Django settings.

## 14. Configuration ownership

Configuration is currently distributed between Django settings, Docker Compose, module-level constants and Windows startup scripts.

This document records the current state only. Consolidation into a central configuration contract belongs to future architecture work.
