# Módulo de Administración

## Propósito

El módulo de Administración agrupa la interfaz utilizada para gestionar usuarios, roles y permisos, y para consultar la auditoría de actividad.

No es una app Django independiente. La funcionalidad se construye sobre tres dominios backend existentes:

- `apps.identity`;
- `apps.permissions`;
- `apps.audit`.

El frontend se encuentra en:

`apps/frontend/src/modules/admin`

La documentación de modelos y comportamiento backend transversal se mantiene en `../backend/identity-permissions-audit.md`. Este documento describe el módulo administrativo como flujo funcional completo de interfaz a API.

## Estado

Estado actual: implementado con deuda de autorización y algunos contratos frontend preparados pero no alineados con el backend.

Rutas activas:

- `/settings/users`;
- `/settings/roles`;
- `/settings/audit`.

Las tres rutas están registradas en `App.tsx`.

## Navegación

La sección Administration del Sidebar está configurada únicamente para el rol legacy `admin`.

Además, `useSidebar` mapea la sección al módulo de permisos `administration` y exige `administration.view`.

Sin embargo, `AppShell` entrega actualmente `admin` como rol fijo al Sidebar.

Por ello la visibilidad efectiva del menú combina:

- rol frontend hardcodeado;
- permisos efectivos del usuario.

La ruta no tiene un `PermissionRoute`; cualquier usuario autenticado puede intentar navegar manualmente a las URLs.

La protección real debe residir en backend.

## Gestión de usuarios

### Pantalla

Componente:

`UsersPage.tsx`

Hook:

`useUsers.ts`

Cliente:

`UsersService`

La pantalla muestra:

- employee ID;
- nombre;
- email;
- roles;
- planta;
- estado;
- último acceso;
- acciones administrativas.

Acciones disponibles:

- crear usuario;
- editar usuario;
- resetear contraseña;
- activar/desactivar usuario.

### Filtros

La pantalla envía al backend:

- `search`;
- `role`;
- `is_active`.

`UsersService.list` también soporta `plant`, aunque la vista actual no presenta un filtro de planta.

Los filtros provocan una nueva carga porque forman parte de las dependencias de `fetchUsers`.

### Endpoints

| Método | Endpoint | Uso |
| --- | --- | --- |
| GET | `/api/v1/auth/users/` | Listar usuarios |
| POST | `/api/v1/auth/users/` | Crear usuario |
| GET | `/api/v1/auth/users/{id}/` | Consultar usuario |
| PATCH | `/api/v1/auth/users/{id}/` | Editar usuario |
| POST | `/api/v1/auth/users/{id}/toggle-active/` | Activar o desactivar |
| POST | `/api/v1/auth/users/{id}/reset-password/` | Reset de contraseña |
| GET | `/api/v1/auth/roles/` | Catálogo para selector de roles |

### Modal de usuario

`UserModal` soporta tres modos:

- `create`;
- `edit`;
- `reset-password`.

En creación solicita:

- employee ID;
- nombre;
- apellido;
- email;
- planta;
- job title;
- idioma;
- contraseña;
- uno o más roles.

En edición no permite modificar `employee_id`.

Los roles se dividen visualmente entre:

- system roles;
- custom roles.

El frontend exige al menos un rol para crear o editar un usuario.

Esta es una regla de UI; el backend puede recibir una lista vacía y no asignar roles.

### Contraseña

En creación y reset, el frontend exige mínimo ocho caracteres.

El backend valida nuevamente el flujo de password y no debe depender de la validación HTML.

El endpoint de reset recibe:

- `new_password`;
- `confirm_password`.

### Activación

`toggle-active` cambia el estado mediante una acción dedicada.

El backend impide que el usuario desactive su propia cuenta.

## Roles y permisos

### Pantalla

Componente:

`RolesPage.tsx`

Cliente:

`PermissionsService`

La pantalla actual es principalmente un editor de matriz de permisos.

Módulos presentados:

- production;
- quality;
- maintenance;
- warehouse;
- administration.

Acciones presentadas:

- view;
- create;
- edit;
- delete.

Cada celda corresponde a una key:

`module.action`

### Flujo

1. La pantalla carga todos los roles con `GET /permissions/roles/`.
2. Selecciona inicialmente el primer rol.
3. Mantiene una copia local de permisos editados y otra de permisos guardados.
4. Marcar una celda agrega o elimina una key.
5. El control "all" activa o desactiva las cuatro acciones de un módulo.
6. Guardar ejecuta `PUT /permissions/roles/{slug}/` con `{ permissions: [...] }`.
7. Descartar restaura el snapshot local.

### Roles de sistema

La interfaz identifica visualmente `is_system`.

El backend permite modificar los permisos de un rol de sistema, pero protege nombre/descripción y evita eliminarlo.

### Funcionalidad backend no expuesta en esta pantalla

La API permite crear roles custom y eliminar roles no-system.

`RolesPage` actual no presenta controles para:

- crear rol;
- renombrar rol custom;
- editar descripción;
- eliminar rol custom.

Por tanto, el backend tiene una capacidad mayor que la interfaz actual.

## Overrides individuales

El backend soporta permisos efectivos por:

1. permisos heredados de roles;
2. overrides individuales grant/revoke.

Endpoint backend:

`/api/v1/permissions/users/{user_id}/`

La vista backend espera operaciones POST con un campo `action`:

- `set_roles`;
- `set_override`;
- `remove_override`.

Para `set_override` espera:

- `permission_key`;
- `override_type`.

No existe actualmente una pantalla administrativa activa que edite esos overrides individuales.

## Diferencias de contrato en PermissionsService

`PermissionsService` contiene funciones cuya forma no coincide con el backend actual.

### getChoices

Frontend:

`GET /permissions/choices/`

Backend real:

`GET /permissions/`

Además, el backend devuelve una lista plana de permisos, no un objeto `{ modules, actions }`.

### getRolePermissions

El tipo frontend declara `Promise<Permission[]>`.

El backend de `GET /permissions/roles/{slug}/` devuelve un objeto de rol con metadata y un array `permissions`.

### setUserOverride

El frontend envía:

- `module`;
- `action`;
- `override_type`.

El backend espera:

- `action = "set_override"`;
- `permission_key`;
- `override_type`.

### removeUserOverride

El frontend intenta un `DELETE` con `module` y `action`.

El backend no publica DELETE para este recurso; espera POST con:

- `action = "remove_override"`;
- `permission_key`.

Estas funciones no forman parte del flujo usado por `RolesPage`, que utiliza `getAllRoles` y `setRolePermissions`.

Deben alinearse antes de construir una UI de overrides sobre ellas.

## Auditoría

### Pantalla

Componente:

`AuditPage.tsx`

Cliente:

`auditApi`

Contiene dos tabs:

- Users;
- Activity.

### Users

`GET /api/v1/audit/users/`

El backend calcula una ventana de 30 días y devuelve por usuario:

- último login;
- última acción en la ventana;
- total de acciones en la ventana;
- estado;
- planta.

La lista se ordena por `last_login_at` descendente.

Desde esta tabla se puede saltar a Activity con el usuario preseleccionado.

### Activity

`GET /api/v1/audit/logs/`

Filtros soportados:

- `user_id`;
- `action`;
- `module`;
- `date_from`;
- `date_to`;
- `search`;
- `page`.

La búsqueda compara employee ID, first name y last name.

La API pagina a 50 registros.

La pantalla calcula el total de páginas con el mismo tamaño de página.

### Acciones registradas

La UI contempla:

- LOGIN;
- LOGOUT;
- CREATE;
- UPDATE;
- DELETE.

El registro de auditoría backend se genera mediante:

- `AuthService` para login/logout;
- `AuditMiddleware` para mutaciones HTTP exitosas.

### Módulos del filtro

La UI declara manualmente:

- identity;
- quality;
- production;
- maintenance;
- warehouse;
- manufacturing;
- permissions.

La lista no se obtiene dinámicamente del backend.

Si aparece un nuevo módulo en `AuditLog`, puede mostrarse en la tabla, pero no estará automáticamente disponible en el dropdown hasta modificar el frontend.

## Internacionalización

Users y Roles utilizan `useTranslation` para la mayor parte de su contenido.

Audit mantiene gran parte de sus labels y textos directamente en español.

Por tanto, la sección Administration no tiene una cobertura i18n uniforme.

## Seguridad

Este es el principal riesgo del módulo.

Las vistas backend revisadas de:

- administración de usuarios;
- roles;
- permisos;
- overrides;
- consulta de auditoría;

utilizan `IsAuthenticated`.

No aplican actualmente `HasModulePermission("administration", ...)` ni una validación equivalente por rol administrativo.

Ocultar la sección en Sidebar no protege la API.

Hasta corregirlo, un usuario autenticado que conozca los endpoints podría intentar acceder directamente a operaciones administrativas.

Este hallazgo ya forma parte de la deuda técnica crítica del proyecto.

## Auditoría de operaciones administrativas

Las operaciones exitosas POST/PATCH/PUT/DELETE pasan por `AuditMiddleware`, salvo rutas excluidas por el propio middleware.

Por diseño, consultar Users/Roles/Audit mediante GET no crea eventos de auditoría.

Las rutas de auditoría se excluyen para evitar auto-registro recursivo.

## Estado frontend

Users y Roles gestionan estado de servidor con hooks y `useState/useEffect`.

No utilizan TanStack Query.

Esto implica:

- cargas explícitas;
- actualización manual del estado después de mutations;
- sin invalidación central de caché.

Audit realiza también cargas manuales.

## Manejo de errores

Users presenta un mensaje general cuando falla el listado o catálogo de roles.

`UserModal` intenta convertir errores de respuesta del backend en una cadena por campo.

Roles presenta mensajes locales de carga/guardado.

Audit utiliza `.finally()` para finalizar loading, pero sus llamadas principales no muestran un estado de error específico al usuario en el código revisado.

## Datos y ownership

Administration no posee una base de datos independiente.

Las entidades principales pertenecen a:

- `identity_user`;
- modelos de Role, Permission, UserRole y overrides;
- `audit_log`.

Los detalles del esquema están documentados en `../backend/identity-permissions-audit.md`.

## Limitaciones actuales

### Enforcement administrativo incompleto

Es una deuda de seguridad prioritaria y debe corregirse en backend antes de confiar en la visibilidad frontend.

### Contratos preparados pero divergentes

Parte de `PermissionsService` no coincide con el backend de overrides/choices.

### Gestión de roles parcial en UI

El backend soporta CRUD mayor que la pantalla Roles.

### Overrides sin UI

El modelo y API existen, pero no hay una vista activa para administrarlos.

### Catálogo de módulos de Audit hardcodeado

El filtro requiere mantenimiento manual.

### i18n parcial en Audit

La pantalla contiene textos españoles directos.

### Sin paginación en Users

La API de Users devuelve la colección resultante sin paginación DRF explícita en la vista revisada.

Para una población grande puede convenir paginación server-side.

## Pruebas

La arquitectura backend dispone de directorios/tests para identity, permissions y audit, pero el documento transversal debe seguir siendo la referencia para cobertura real.

Escenarios prioritarios del módulo administrativo:

1. usuario sin `administration.view` no puede leer datos administrativos;
2. usuario sin `administration.edit` no puede crear/editar usuarios o permisos;
3. admin sí puede ejecutar cada operación permitida;
4. un usuario no puede desactivarse a sí mismo;
5. roles de sistema no pueden eliminarse;
6. modificación de permisos de roles de sistema;
7. creación y eliminación de roles custom;
8. grant/revoke individual;
9. filtros y paginación de auditoría;
10. auditoría de mutaciones administrativas;
11. traducción de Users/Roles/Audit;
12. contratos TypeScript contra respuestas backend.

## Regla de mantenimiento

Cambios en identity, permissions o audit que afecten pantallas administrativas deben actualizar este documento además de la documentación backend transversal.

La autoridad de seguridad debe permanecer en backend. La navegación y controles frontend deben tratarse únicamente como UX.
