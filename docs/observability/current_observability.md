# Current Observability and Audit Behavior

## 1. Scope

This document records observability mechanisms currently present in the repository. It intentionally separates implemented behavior from observability capabilities proposed for future architecture.

## 2. Application logging

The development Django settings configure a console logging handler.

The root log level is DEBUG.

No structured JSON formatter is configured in the reviewed settings.

No global request identifier or correlation identifier is configured.

No centralized log transport is configured in the reviewed application settings.

## 3. Audit middleware

AuditMiddleware is part of the Django middleware chain.

It records successful state-changing HTTP operations.

The middleware maps POST to CREATE, PUT and PATCH to UPDATE, and DELETE to DELETE.

GET requests are not recorded by this middleware.

Responses with status codes of 400 or higher are not recorded.

Administrative, static, media and debug-toolbar paths are excluded.

The audit API itself is excluded to avoid recursive audit creation.

## 4. Audit identity resolution

The middleware reads the Authorization header and independently validates a Bearer JWT using JWTAuthentication.

When authentication cannot be resolved, no audit record is created.

## 5. Audit metadata

Audit records may include the following information.

| Field | Source |
|---|---|
| user | Validated JWT |
| action | HTTP method mapping |
| module | API path |
| resource | API path |
| resource_id | Selected response-body id |
| description | Selected response field |
| ip_address | X-Forwarded-For first value or REMOTE_ADDR |
| user_agent | Request header |
| timestamp | Database creation time |

The middleware attempts to derive a human-readable description from selected response fields such as brief_description, name, description, title or employee_id.

## 6. Audit failure behavior

Audit creation is enclosed in a broad exception handler.

An audit write failure does not cause the original application response to fail.

This preserves request availability but can make audit loss silent unless the failure is surfaced elsewhere.

## 7. Domain-specific audit

Problem Control contains a separate ProblemAudit model.

It stores problem, user, action, JSON change data, IP address and timestamp.

This domain audit is distinct from the generic HTTP mutation AuditLog.

## 8. Task state

Celery task-start tracking is enabled.

Celery results are stored in the Django database.

Incoming Inspection persists additional synchronization status in IncomingInspectionSyncState.

These mechanisms provide operational state but do not form a unified observability model.

## 9. Cache instrumentation

Cache hit and miss behavior is implemented in code paths, but no platform-wide cache metric exporter is identified in the reviewed configuration.

COGP service logs include selected information about weeks calculated from cache versus Plex, but this is application logging rather than centralized metric instrumentation.

## 10. Dependency timing

HTTP clients configure explicit timeouts in multiple integration paths.

No shared dependency-latency metric, request tracing span or distributed trace propagation is present in the reviewed architecture.

## 11. Infrastructure health

Docker defines health checks for PostgreSQL and Redis.

The reviewed composition does not define Docker health checks for Django, Celery, frontend, Plex proxy or Q-Wall proxy.

Q-Wall proxy exposes a /health endpoint.

No single PlatformSSI dependency-health endpoint is established in the reviewed source.

## 12. Error monitoring dependencies

production.txt includes sentry-sdk with Django support.

No Sentry configuration was identified in the reviewed Django settings.

The dependency therefore represents available production tooling rather than confirmed active monitoring.

## 13. Current observability boundary

The current system provides console logs, generic mutation auditing, Problem Control auditing, Celery task state, selected synchronization state and limited infrastructure health checks.

Prometheus metrics, Grafana dashboards, OpenTelemetry tracing, structured application logs, global request correlation and centralized dependency-health reporting are not part of the confirmed current architecture.
