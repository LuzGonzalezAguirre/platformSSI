# Identidad, permisos y auditoría

## Alcance

Este documento cubre `apps.identity`, `apps.permissions` y `apps.audit`.

Los tres módulos forman la capa transversal de acceso de platformSSI: identidad determina quién es el usuario, permisos determina qué debería poder realizar y auditoría registra sesiones y mutaciones exitosas.

## Modelo de usuario

platformSSI reemplaza el username estándar de Django por `employee_id`.

La tabla declarada para el usuario es `identity_user`.

Campos adicionales relevantes:

| Campo | Uso |
| --- | --- |
| `employee_id` | Identificador único y USERNAME_FIELD |
| `roles` | Relación Many to Many con Role mediante UserRole |
| `plant` | Planta asociada |
| `job_title` | Puesto |
| `preferred_language` | Preferencia es/en |
| `preferred_theme` | light, dark o system |
| `timezone` | Zona horaria individual |
| `last_login_at` | Último acceso registrado por AuthService |
| `avatar` | Imagen de perfil |
| `is_active` | Habilitación de cuenta |

El timezone predeterminado del usuario es `America/Tijuana`, mientras que el timezone global del backend está configurado como `America/Monterrey`. La diferencia es válida técnicamente, pero debe revisarse cuando se documenten reglas basadas en fecha y hora.

## Autenticación

`POST /api/v1/auth/login/` acepta número de empleado y contraseña.

Cuando las credenciales son correctas, `AuthService` actualiza `last_login_at`, crea un registro de auditoría LOGIN y entrega access token, refresh token y datos del usuario.

El refresh token incluye adicionalmente `employee_id` y `plant`.

`POST /api/v1/auth/logout/` intenta agregar el refresh token al blacklist y registra LOGOUT.

`POST /api/v1/auth/refresh/` emite un nuevo access token a partir del refresh token.

`GET /api/v1/auth/me/` devuelve el usuario autenticado.

## Perfil

El usuario puede actualizar su perfil mediante `/api/v1/auth/me/update/`, cambiar contraseña mediante `/api/v1/auth/me/change-password/` y cargar avatar mediante `/api/v1/auth/me/avatar/`.

El avatar acepta JPEG, PNG y WEBP y tiene un límite de 2 MB implementado en la vista.

Cuando se reemplaza un avatar existente, el archivo anterior se elimina antes de guardar el nuevo.

## Administración de usuarios

La API permite listar, crear, consultar, editar, activar o desactivar y restablecer contraseñas.

El listado soporta filtros por rol, planta, estado activo y texto de búsqueda.

`UserService.update_user` protege `employee_id`, `password` e `is_superuser` frente a edición mediante el flujo normal.

Un usuario no puede desactivar su propia cuenta mediante `toggle_active`.

El reset de contraseña exige como mínimo ocho caracteres dentro del servicio.

## Modelo de permisos

El catálogo utiliza permisos con forma `module.action`.

Módulos definidos:

| Valor | Dominio |
| --- | --- |
| `production` | Producción |
| `quality` | Calidad |
| `maintenance` | Mantenimiento |
| `warehouse` | Almacén |
| `administration` | Administración |

Acciones definidas:

| Valor | Significado |
| --- | --- |
| `view` | Lectura |
| `create` | Creación |
| `edit` | Edición |
| `delete` | Eliminación |

`Permission.save` genera la clave a partir del módulo y la acción.

## Roles

`Role` agrupa permisos mediante `RolePermission`.

`UserRole` relaciona usuarios con uno o más roles.

Existen roles de sistema sembrados por `PermissionService`, incluyendo Operator, Supervisor, Quality Engineer, Process Engineer, Maintenance Engineer, Inventory Engineer, MES Admin y Plant Manager.

Los roles de sistema pueden modificar su conjunto de permisos por la API actual, pero no pueden eliminarse ni modificar nombre y descripción mediante `RoleDetailView`.

## Overrides

`UserPermissionOverride` permite otorgar o revocar un permiso de forma individual.

El cálculo efectivo realiza primero la unión de permisos de los roles y posteriormente aplica overrides.

Un superusuario recibe todas las acciones de todos los módulos sin consultar roles.

## Utilidad DRF

`HasModulePermission` y `module_permission()` permiten convertir permisos de dominio a clases de permiso de Django REST Framework.

Las solicitudes seguras utilizan por defecto la acción `view`.

Las solicitudes de escritura utilizan por defecto `edit`, salvo configuración distinta en la clase generada.

## API de permisos

| Endpoint | Uso |
| --- | --- |
| `GET /api/v1/permissions/` | Catálogo |
| `GET, POST /api/v1/permissions/roles/` | Listado y creación de roles |
| `GET, PUT, DELETE /api/v1/permissions/roles/{slug}/` | Gestión de rol |
| `GET, POST /api/v1/permissions/users/{id}/` | Roles y overrides de usuario |
| `GET /api/v1/permissions/me/` | Permisos efectivos del usuario actual |

## Auditoría

`AuditLog` conserva usuario, acción, módulo, recurso, resource_id, descripción, IP, user agent y timestamp.

La tabla definida es `audit_log`.

Las acciones modeladas son LOGIN, LOGOUT, CREATE, UPDATE y DELETE.

LOGIN y LOGOUT se registran explícitamente desde `AuthService`.

Las mutaciones HTTP exitosas se registran mediante `AuditMiddleware`.

## Comportamiento de AuditMiddleware

El middleware traduce POST a CREATE, PUT y PATCH a UPDATE, y DELETE a DELETE.

No registra GET.

No registra respuestas con status 400 o superior.

No registra las propias rutas de auditoría para evitar recursión.

Intenta autenticar de nuevo el Bearer token desde el header para obtener al usuario.

El módulo y recurso se infieren a partir de segmentos del path.

Cuando la respuesta es JSON, intenta obtener un identificador y una descripción a partir de campos conocidos.

Los errores al crear un AuditLog se silencian para no romper la respuesta principal.

## Consulta de auditoría

`GET /api/v1/audit/users/` calcula actividad de los últimos 30 días por usuario.

`GET /api/v1/audit/logs/` soporta filtros por usuario, acción, módulo, rango de fechas y búsqueda por datos del usuario.

El listado de logs se pagina con 50 registros por página.

## Autorización administrativa

Los endpoints administrativos aplican RBAC real mediante `HasMappedModulePermission`.

La vista define explícitamente el módulo y la acción requerida por método HTTP. Para Administration se utilizan:

- `administration.view` para consultas;
- `administration.create` para creación de usuarios y roles;
- `administration.edit` para mutaciones no destructivas, reset de contraseña, toggle de estado, asignación de roles y overrides;
- `administration.delete` para eliminación de roles custom.

El permiso se evalúa mediante `PermissionService.has_permission`, por lo que la autorización utiliza permisos efectivos de roles más overrides individuales. Los superusuarios reciben todas las acciones de todos los módulos.

La ruta `/api/v1/permissions/me/` conserva `IsAuthenticated` porque expone únicamente los permisos efectivos del usuario autenticado.

La suite `apps.permissions.tests.AdministrationRBACAPITests` cubre denegación y autorización positiva, rol de sistema con lectura, MES Admin, superuser y protección de roles de sistema.

## Interfaz administrativa

Para el flujo completo de la interfaz administrativa de Users, Roles y Audit, sus contratos frontend y limitaciones actuales, consultar `../modules/administration.md`.


## Profile

Para el flujo completo de autoservicio de Profile, sincronización de preferencias, avatar y limitaciones de la UI, consultar `../modules/profile.md`.


## Autenticación de sesión

Para el flujo completo de login, JWT, refresh, logout, persistencia frontend y las diferencias entre `/auth/me/` y Profile, consultar `../modules/authentication.md`.
