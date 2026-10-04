# Current Implementation Notes

## 1. Purpose

This document records factual implementation characteristics that are relevant when reading the current architecture. It is not a future-state recommendation list.

## 2. Duplicate maintenance URL registration

config/urls.py registers api/v1/maintenance twice with the same apps.maintenance.urls module.

This is a duplicate route registration in the current source and does not represent two separate maintenance services.

## 3. Structural Django applications

analytics, core, integrations and manufacturing are installed applications with directory structure for models, repositories, serializers, services, tests and views.

Large portions of those packages are currently empty.

Their architectural presence should therefore be distinguished from implemented business functionality.

## 4. SSI auxiliary applications

ssi_attendance and ssi_chairs exist in the backend repository and contain views and services.

They are not present in the LOCAL_APPS list reviewed in config/settings/base.py and are not wired into the root URL configuration reviewed.

Current Production CCS and chair endpoints are implemented through apps.production.views.ccs_views.

The runtime role of ssi_attendance and ssi_chairs therefore requires explicit verification before they are described as active Django applications.

## 5. ssi_common registration

The root URL configuration includes apps.ssi_common.urls under api/v1/common.

ssi_common was not present in the reviewed LOCAL_APPS list.

Because the package does not necessarily require Django model registration to be imported as a URL module, the route can still function, but its registration state should be treated separately from installed Django applications.

## 6. Development-oriented Docker runtime

The main Docker Compose file uses config.settings.development, Django runserver and the Vite development server.

The file therefore represents a development-style runtime even though it is also involved in the current host startup workflow.

## 7. Production dependency file without production settings profile

requirements/production.txt provides Gunicorn, WhiteNoise and Sentry SDK.

No config/settings/production.py file was found in the reviewed repository state.

The repository therefore contains some production dependencies without a complete production Django settings profile in the same configuration structure.

## 8. Secret values in source configuration

The Docker Compose files and selected settings defaults contain secret-like configuration values directly in source.

The values are intentionally excluded from this documentation.

This is a current repository characteristic and should be considered when distributing repository copies or generated documentation.

## 9. Q-Wall lot-sampling persistence migration

PostgreSQL Q-Wall lot-sampling models were introduced in migration 0008 and removed in migration 0009.

Current lot-sampling SQL objects are represented in the CCS SQL Server script and Q-Wall proxy.

Documentation must therefore avoid treating historical migration models as current PostgreSQL ownership.

## 10. Cache implementation is distributed

Cache policies are implemented independently in Q-Wall, COGP, maintenance, work requests, down equipment, OPS reporting and synchronization logic.

The repository already contains key versioning, differential TTL, warming and stampede protection in selected locations, but there is no single platform cache policy component in the current architecture.

## 11. Mixed integration styles

The backend uses httpx in Plex client abstractions and requests in several other services and repositories.

Timeout values and retry behavior are therefore module-specific rather than globally standardized.

## 12. Audit failure suppression

AuditMiddleware suppresses exceptions raised while writing AuditLog records.

The original request remains successful when auditing fails.

This behavior should be considered when interpreting audit completeness.

## 13. Q-Wall proxy lifecycle

Q-Wall proxy code is in the repository but the service is not part of docker-compose.yml.

The current Windows startup path starts it separately under Uvicorn.

## 14. Plex proxy lifecycle

The backend depends on a Plex proxy on host port 8001.

The PlatformSSI repository contains the startup script reference but not the Plex proxy source tree itself.

## 15. Current documentation state

The repository previously contained specialized Q-Wall lot-sampling documentation and a small architecture test file.

The system-wide technical documentation introduced in docs is intended to consolidate current-state knowledge while preserving specialized documentation until it has been reviewed and incorporated.
