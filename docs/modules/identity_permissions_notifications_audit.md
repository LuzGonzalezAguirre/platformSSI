# Identity, Permissions, Notifications and Audit

## 1. Scope

Identity, Permissions, Notifications and Audit provide cross-cutting PlatformSSI control functions used by the functional business modules.

## 2. Identity

PlatformSSI uses identity.User as its custom Django user model.

employee_id is the JWT identity claim.

The identity API supports login, logout, token refresh, current-user retrieval, profile update, password change, avatar upload, user administration, active-state control, password reset and role-choice retrieval.

Identity has repository and service layers for authentication, profile and user-management behavior.

## 3. Token authentication

SimpleJWT provides Bearer token authentication.

Access tokens expire after 60 minutes.

Refresh tokens expire after 7 days.

Refresh token rotation and blacklist-after-rotation are enabled.

Login and refresh endpoints allow unauthenticated access as required to establish or renew authentication.

## 4. Permission model

Permission stores a unique permission key categorized by module and action.

Role groups permissions.

RolePermission implements the many-to-many relationship.

UserRole associates users with roles.

UserPermissionOverride allows a user-specific grant or deny behavior beyond role defaults.

The permissions API exposes available permissions, role administration, per-user permission operations and current-user permission retrieval.

## 5. DRF permission integration

The permissions package contains drf.py for permission-class integration with Django REST Framework.

Some functional modules, such as Production Safety, already use domain-specific permission classes.

Many other current views use IsAuthenticated directly.

## 6. Frontend roles

The sidebar recognizes operador, tecnico, lider, supervisor, ingeniero, admin and gerente.

Navigation filtering is role-aware.

Backend authorization remains the security boundary regardless of frontend visibility.

## 7. Notifications

Notification stores recipient, actor, notification type, title, message, module, related entity, action URL, metadata, task state, read state, resolved state and timestamps.

event_key is unique and is used by NotificationService to prevent duplicate logical notifications.

The notification API supports feed retrieval, mark individual read and mark all read.

A notification can be marked read without resolving the underlying task.

Tests confirm user isolation for notification access.

## 8. Problem Control notification behavior

NotificationService provides team-member assignment notification and action-assignment synchronization.

Action reassignment can resolve or replace notification state according to the responsible user.

Problem Control therefore uses notifications as persistent application state rather than transient browser-only messages.

## 9. Generic audit

AuditMiddleware records successful POST, PUT, PATCH and DELETE requests for authenticated JWT users.

It derives module and resource from the API path.

It records selected response context, IP address and user agent.

Audit endpoints are excluded from self-auditing.

## 10. Audit API

The Audit application exposes user lookup and audit-log listing.

The frontend provides /settings/audit for administration.

## 11. Problem-specific audit

Problem Control uses ProblemAudit for domain-specific changes.

This is separate from generic request audit and allows the quality workflow to preserve richer change context.

## 12. Failure behavior

Generic audit write errors are suppressed by the middleware to avoid failing the original request.

This means application availability is prioritized over guaranteed audit persistence in the current implementation.
