# Authentication and Authorization

## 1. Authentication model

PlatformSSI uses a custom Django user model identified as identity.User.

API authentication uses JSON Web Tokens through djangorestframework-simplejwt.

The JWT user identifier field and claim are both employee_id.

## 2. Token lifecycle

Access token lifetime is configured to 60 minutes.

Refresh token lifetime is configured to 7 days.

Refresh token rotation is enabled.

Refresh token blacklisting after rotation is enabled.

The accepted authorization header type is Bearer.

## 3. Default API protection

Django REST Framework uses JWTAuthentication as the default authentication class.

IsAuthenticated is the default permission class.

An endpoint is therefore authenticated by default unless the view explicitly overrides the framework setting.

## 4. User profile information

The custom user model includes employee identifier, role relationships, plant, job title, preferred language, preferred theme, timezone, last login information, active status and avatar.

## 5. Role and permission data model

The permission system contains Permission, Role, RolePermission, UserPermissionOverride and UserRole entities.

Permission keys are categorized by module and action.

RolePermission provides the role-to-permission relationship.

UserPermissionOverride supports explicit user-specific behavior beyond role defaults.

## 6. Frontend role-aware navigation

The current frontend sidebar defines operador, tecnico, lider, supervisor, ingeniero, admin and gerente.

Administration navigation is restricted to admin.

Q-Wall settings navigation is restricted to admin and ingeniero.

Warehouse demand navigation is restricted to supervisory roles.

Most operational sections are visible to all defined roles.

Frontend visibility is a user-interface control and must not be treated as a replacement for backend authorization.

## 7. Audit controls

A custom AuditMiddleware is included in the Django middleware chain.

The AuditLog model records user, action, module, resource, resource identifier, description, IP address, user agent and timestamp.

Problem Control also contains a ProblemAudit entity for domain-specific change history.

## 8. Proxy authentication

Plex proxy communication uses a configured shared secret.

Q-Wall proxy communication uses a configured token.

Protected Q-Wall proxy endpoints apply token verification.

Action Tracker bot credentials are represented through configuration variables.

## 9. Development security posture

The development settings use DEBUG enabled, wildcard allowed hosts and allow all CORS origins.

The Docker development composition includes credential and secret values directly in configuration.

These values are not reproduced in technical documentation.

The reviewed repository should not be interpreted as defining a hardened production security profile.

## 10. Security boundaries not established from repository

A complete production assessment requires verification of reverse-proxy configuration, TLS termination, operating-system permissions, host firewall rules, secret rotation, database privileges, network segmentation and backup access controls.

Those controls cannot be confirmed from the current application repository alone.
