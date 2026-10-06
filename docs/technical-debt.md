# Registro de deuda técnica

## Propósito

Este documento consolida hallazgos detectados durante la documentación AS-IS.

No significa que todos deban corregirse en el mismo cambio.

La prioridad considera impacto potencial sobre seguridad, disponibilidad, mantenibilidad y consistencia de datos.

## Prioridad crítica

### SEC-001 - Retirar y rotar secretos versionados

**Prioridad:** Crítica  
**Estado:** Mitigada; rotación pendiente por decisión operativa del 06-Oct-2026.

Se detectaron credenciales, tokens y valores de conexión funcionales definidos en archivos versionados de configuración, Docker Compose y Q-Wall Proxy.

Cambios aplicados:

- los secretos activos fueron retirados de `docker-compose.yml`, settings de Django y Q-Wall Proxy;
- PostgreSQL, Redis, Plex Proxy, Q-Wall Proxy, Django y la conexión CCS reciben los valores desde variables de entorno;
- `QWALL_DB_CONN_STR` también fue externalizada aunque utilice Windows Integrated Security;
- se agregó `.env.example` únicamente con placeholders y valores no sensibles;
- `.env` continúa excluido por Git;
- Django y Q-Wall Proxy fallan al iniciar si falta un secreto obligatorio;
- Q-Wall Proxy carga el `.env` de la raíz cuando se ejecuta directamente en Windows;
- se agregó secret scanning en CI mediante Gitleaks.

Pendiente para cierre completo:

- rotar los tokens y credenciales que estuvieron versionados anteriormente;
- actualizar los valores reales en el `.env` del servidor y en cualquier sistema externo que comparta esos secretos;
- considerar limpieza de historial únicamente después de coordinar la rotación, porque los valores anteriores continúan presentes en commits históricos.

Mientras los valores históricos sigan siendo válidos, SEC-001 no debe marcarse como cerrada.

### SEC-002 - Aplicar RBAC real a endpoints administrativos

**Prioridad:** Crítica  
**Estado:** Resuelta el 06-Oct-2026.

Se aplicó enforcement backend de `administration.view/create/edit/delete` sobre los endpoints administrativos de Users, Roles, Permissions, overrides y Audit.

Reglas aplicadas:

- lectura de usuarios, roles, permisos, overrides y auditoría: `administration.view`;
- creación de usuarios y roles custom: `administration.create`;
- edición de usuarios, reset de contraseña, activar/desactivar, edición de roles, asignación de roles y overrides: `administration.edit`;
- eliminación de roles custom: `administration.delete`;
- `GET /permissions/me/` permanece disponible para cualquier usuario autenticado porque representa sus propios permisos efectivos.

La autorización se resuelve con `PermissionService`, por lo que respeta unión de roles, grants/revokes individuales y el bypass total de superuser.

Se añadieron pruebas positivas y negativas que cubren usuario autenticado sin permisos, Plant Manager con lectura administrativa, MES Admin, superuser, mutaciones de usuario, Audit, catálogo de permisos y protección de roles de sistema.

La visibilidad del frontend continúa siendo una capa de UX; la autoridad de seguridad está ahora en backend.

## Prioridad alta

### Downtime assignment write sin RBAC específico

El PUT de asignaciones de Downtime está marcado en el código como pendiente de endurecimiento y utiliza únicamente autenticación.

Debe limitarse a los roles definidos por negocio.

### Tracebacks y detalles internos desde Q-Wall Proxy

Algunos handlers devuelven el traceback completo dentro del detalle HTTP.

Esto puede revelar SQL e infraestructura.

Los detalles deben quedar en log interno y la respuesta debe ser controlada.

### Runtime de desarrollo

Django usa `runserver` y frontend usa Vite dev server.

Para producción debe existir un runtime explícito y endurecido.

### Scripts de arranque ambiguos

Los `.bat` versionados contienen sintaxis de PowerShell que parece generar archivos Batch.

Debe definirse un único formato ejecutable y probarse desde cero en un host limpio.

### Backup y restore no documentados/automatizados

El repositorio no contiene un procedimiento reproducible para PostgreSQL, media ni dependencias CCS.

Antes de considerar recuperación operativa, backup y restore deben probarse.

### Observabilidad insuficiente

No existe infraestructura de métricas, trazas o alertas centralizadas.

Los fallos de proxies, Celery y jobs semanales deberían ser detectables sin revisar manualmente consolas.

## Prioridad media

### Sidebar con rol admin hardcodeado

`AppShell` pasa `admin` al Sidebar independientemente del usuario.

Debe usarse el modelo real de permisos/roles.

### Taxonomías de roles duplicadas

Frontend y backend mantienen nombres y categorías de roles diferentes.

Debe existir una sola autoridad.

### Guards de rutas frontend

`PrivateRoute` valida únicamente autenticación.

Conviene añadir guards por permiso para UX, manteniendo backend como autoridad de seguridad.

### Contratos divergentes en PermissionsService

Parte del cliente frontend de permisos no coincide con la API backend actual.

Ejemplos:

- `getChoices` solicita `/permissions/choices/`, mientras el backend publica el catálogo en `/permissions/`;
- `getRolePermissions` tipa una lista de permisos, pero el backend devuelve un objeto de rol;
- `setUserOverride` no envía el campo `action` ni `permission_key` esperados por backend;
- `removeUserOverride` utiliza DELETE, mientras el backend implementa la eliminación como POST con `action="remove_override"`.

La matriz activa de Roles no depende de esos métodos, pero deben corregirse antes de implementar administración de overrides o reutilizar esas funciones.

### Generalización incompleta del centro de notificaciones

El modelo backend de notificaciones es genérico, pero la presentación frontend continúa acoplada al caso de Problem Control.

Hallazgos:

- el backend soporta `scope=unread`, pero la UI solo expone `all` y `pending`;
- cuando `metadata.step` no existe, el frontend muestra "Problem Control" aunque `module` pudiera pertenecer a otro dominio;
- los textos persistidos por `NotificationService` se generan en inglés y no cambian con el idioma del usuario;
- no existe una política de retención o purge de `core_notification`.

Antes de ampliar el módulo a otros dominios conviene desacoplar la presentación de Problem Control y definir una política de lifecycle histórico.

### Profile contiene capacidades visuales no respaldadas o incompletas

La pantalla de Profile presenta o prepara elementos que no corresponden todavía a una capacidad completa.

Hallazgos:

- "Active Sessions" muestra una sola sesión de forma estática y no existe API de sesiones/dispositivos;
- se calculan permisos y existen estilos/componentes asociados, pero la lista no se renderiza;
- `UserSerializer.requires_email` devuelve `bool(email)`, por lo que el nombre no representa la regla de obligatoriedad por rol;
- el catálogo de timezone vive hardcodeado en frontend;
- `preferred_theme` se guarda tanto en backend como en `mes_theme`, creando dos fuentes que deben mantenerse sincronizadas.

La UI debe representar únicamente datos reales o marcar explícitamente placeholders, y los contratos de preferencia deben tener una fuente de verdad definida.

### API URL frontend hardcodeada

El cliente compartido define localhost en código aunque Compose suministra una variable Vite.

Debe leerse configuración de ambiente.

### Contratos de Auth inconsistentes

El flujo de autenticación presenta dos diferencias de contrato relevantes.

`MeView.patch` usa `UserSerializer` como serializer de escritura y expone un conjunto más amplio de campos que `ProfileUpdateSerializer`, incluyendo metadata de cuenta como `plant`, `job_title` e `is_active`.

Además, `ROTATE_REFRESH_TOKENS=True` está configurado, pero el endpoint custom de refresh devuelve únicamente un access token y no implementa la rotación estándar de Simple JWT.

Acción recomendada:

- retirar o restringir PATCH de `/auth/me/` a los mismos campos de Profile;
- definir si refresh tokens deben rotarse realmente;
- alinear settings, endpoint y frontend con una sola política de sesión.

### Refresh token sin renovación automática

Se almacena refresh token, pero el interceptor no intenta renovar access token.

Definir una política única de sesión.

### Implementaciones duplicadas de Attendance / Chairs

Los paquetes SSI paralelos no están conectados y además contienen referencias faltantes.

La función activa vive bajo Production.

Debe elegirse una implementación canónica.

### Métodos duplicados en Production

Se detectaron definiciones repetidas de:

- `CcsAttendanceDailyView`;
- `AttendancePolicy.resolve_hours`;
- `OpsDailyPDFExportView.get`.

Python utiliza la última definición, pero esto genera ambigüedad y riesgo de modificar una versión inactiva.

### Método Q-Wall Repository duplicado

`get_part_numbers` aparece dos veces.

Debe mantenerse una sola implementación.

### Semántica de include_test

En Q-Wall, `include_test=true` selecciona únicamente pruebas.

El nombre sugiere que las incluiría junto con producción.

Renombrar o cambiar contrato explícitamente.

### Contrato CTB incompleto

El frontend espera metadata de revisión activa que el serializer backend no declara.

Alinear DTO backend/frontend.

### Rechazo Problem Control: comentario versus código

El comentario de aprobación final sugiere conservar aprobaciones previas, pero el código de rechazo las limpia.

La regla de negocio debe decidirse y reflejarse igual en código, tests y documentación.

### Contrato parcial del chatbot Q-Wall

El chatbot declara capacidades configurables que no están completas de extremo a extremo.

Hallazgos:

- `ChatbotQuestionTemplate.required_filters` no es la fuente utilizada por el runtime; el servicio consulta `intent.required_filters`;
- `media_list` existe en modelos y DTO, pero el widget no renderiza `media`;
- el fixture versionado contiene texto español con problemas de encoding y una referencia fija de `created_by`.

Antes de ampliar el chatbot conviene alinear el contrato, agregar tests y reemplazar el fixture por un mecanismo portable de seed.

### Semántica y configuración de Operational Panel

El dashboard transversal mezcla reglas configurables y reglas hardcodeadas.

Hallazgos:

- MTTR y MTBF leen targets configurados, mientras Yield FPY, OEE, completion de WR, backlog y scrap usan umbrales locales;
- en modo rango, un OEE persistido del último día tiene prioridad sobre el OEE live del rango aunque la tarjeta se etiqueta con el periodo completo;
- Producción solo renderiza Volvo, Cummins y TULC aunque el contrato de Daily Summary admite BUs dinámicas;
- el KPI usa `wr.kpis.backlog`, pero el subtítulo español lo describe como Work Requests vencidas;
- los colores de status de WR dependen de coincidencias de texto;
- fallos HTTP se representan igual que ausencia real de datos.

Conviene normalizar la semántica de periodo, centralizar targets, distinguir errores de datos vacíos y eliminar dependencias de labels para reglas visuales.

### Action Tracker URL hardcodeada en proxy

Existe configuración para Action Tracker, pero el endpoint de referencias construye links con un host fijo.

Usar configuración.

### Main Q-Wall Proxy monolítico

El archivo principal agrupa Q-Wall, attendance, chairs, settings, outboxes, Action Tracker y lot sampling.

Dividir por routers/repositories.

### SQL inline en proxy

Mover queries complejas a repositories facilita pruebas y manejo de conexión.

### Restricción por Business Unit no implementada

`get_allowed_bu_for_user` devuelve todas las BUs para todos los usuarios.

La infraestructura para centralizar el filtro existe, pero la política real está pendiente.

## Prioridad baja o limpieza

### Duplicate maintenance URL include

El prefijo Maintenance aparece dos veces en `config/urls.py`.

Eliminar duplicado para evitar confusión.

### requirements.txt raíz del backend

El archivo no representa la definición completa de dependencias y contiene entradas redundantes.

Definir una única convención de requirements.

### Archivos históricos Quality

Existen backups y archivos old dentro del paquete activo.

Moverlos fuera del runtime o eliminarlos una vez confirmado que no se necesitan.

### Árbol backend dentro del frontend

Existe scaffolding vacío de backend bajo `apps/frontend/src/apps/backend`.

Eliminarlo si no tiene propósito.

### Componentes Maintenance vacíos

Se observaron archivos de componentes sin implementación dentro de Work Requests.

Eliminar o implementar para evitar falsas señales de funcionalidad.

### Nombre de archivo Problem List

`ProlemListPage.tsx` contiene un typo.

No afecta el runtime mientras imports coincidan, pero reduce claridad.

## Mejoras de ingeniería recomendadas

Después de atender seguridad, los siguientes bloques aportarían mayor estabilidad:

1. suite de tests de contratos proxy;
2. CI con build y tests;
3. healthchecks de servicios;
4. structured logging;
5. métricas de Celery y proxies;
6. documentación OpenAPI consolidada;
7. configuración por ambiente;
8. tests de autorización por endpoint;
9. limpieza de código inactivo.

## Regla de seguimiento

Cuando una deuda se corrija:

- el mismo PR debe actualizar este documento;
- debe eliminarse o marcarse como resuelta;
- si cambia arquitectura o contrato, actualizar además el documento del módulo correspondiente.
