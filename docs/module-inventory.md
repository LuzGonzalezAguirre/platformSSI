# Inventario de módulos

## Propósito

Este documento clasifica cada área relevante del repositorio según su estado observable.

La existencia de un directorio no implica que exista funcionalidad operativa.

Estados utilizados:

- Implementado: existe un flujo funcional conectado a la aplicación.
- Parcial: existe funcionalidad, pero hay dependencias, contratos o partes incompletas.
- Estructura: existe scaffolding sin flujo funcional suficiente.
- No conectado: existe implementación de código, pero no está registrada en el runtime principal.
- Placeholder: existe una ruta o elemento visual explícitamente marcado como futuro.

## Backend Django

| Aplicación | Estado | Evidencia principal |
| --- | --- | --- |
| identity | Implementado | Modelo User, auth, profile y administración de usuarios |
| permissions | Implementado con deuda | RBAC existe; enforcement administrativo incompleto |
| audit | Implementado | Middleware, modelo y API |
| notifications | Implementado | Persistencia y sincronización con Problem Control |
| production | Implementado | Ops, targets, safety, attendance, productivity |
| quality | Implementado | Q-Wall, COGP, Problem Control, Incoming, Downtime |
| maintenance | Implementado | KPIs, WR, PMP, down equipment, corrective actions |
| warehouse | Implementado | BOM, CTB y Demand mediante Plex Proxy |
| ssi_common | Implementado como librería | Clasificación, filtros, rangos y Action Tracker refs |
| ssi_attendance | No conectado | No está en INSTALLED_APPS ni config URLs |
| ssi_chairs | No conectado | No está en INSTALLED_APPS ni config URLs |
| analytics | Estructura | URLs vacías; subpaquetes sin implementación |
| manufacturing | Estructura | URLs vacías; subpaquetes sin implementación |
| core | Estructura | Archivos y subpaquetes vacíos |
| integrations | Estructura | Archivos y subpaquetes vacíos |

## analytics

La app está registrada en `INSTALLED_APPS` y su URL se incluye bajo `/api/v1/analytics/`.

Sin embargo:

- `urls.py` no publica endpoints;
- models está vacío;
- repositories está vacío;
- serializers está vacío;
- services está vacío;
- views está vacío;
- tests está vacío.

Debe tratarse como namespace reservado.

## manufacturing

La app está registrada y su URL se incluye bajo `/api/v1/manufacturing/`.

Tiene el mismo patrón de scaffolding vacío que analytics.

No se debe documentar una función de manufactura específica hasta que exista código que la implemente.

## core

`apps.core` está registrado en Django.

Actualmente no tiene modelos, URLs, services, views ni lógica compartida.

No funciona todavía como una librería core real.

La lógica compartida más relevante vive hoy en `ssi_common` y en services específicos.

## integrations

`apps.integrations` está registrado en Django pero vacío.

Las integraciones reales viven actualmente dentro de módulos de dominio y en `apps/qwall-proxy`.

Si se decide utilizar este paquete, debería tener un propósito explícito, por ejemplo clientes y contratos externos comunes, evitando mover lógica solo por organización visual.

## Frontend

| Módulo | Estado | Notas |
| --- | --- | --- |
| auth | Implementado | Login y hook de sesión |
| admin | Implementado con deuda | Users, roles y audit activos; detalle en `modules/administration.md`; backend auth debe endurecerse |
| profile | Implementado | Perfil, avatar, preferencias, contraseña |
| notifications | Implementado | Centro de notificaciones |
| operational-panel | Implementado | Dashboard agregado de varias áreas; detalle en `modules/operational-panel.md` |
| production | Implementado | Documentado por submódulos |
| quality | Implementado | Documentado por submódulos |
| incoming-inspection | Implementado | Ruta activa dentro de Quality |
| qwall-settings | Implementado | Ruta activa con autorización backend |
| maintenance | Implementado | Documentado por submódulos |
| warehouse | Implementado | BOM/CTB/Demand |
| ssi/attendance | No conectado | Dashboard sin ruta activa |
| ssi/chair-control | No conectado | Dashboard sin ruta activa |
| ssi/safe-launch | No conectado | Tutorial sin ruta activa |

## Auth frontend

`LoginPage` y `useAuth` están activos.

Al montar un usuario autenticado, `useAuth` solicita `/auth/me/` para refrescar datos y permisos.

El interceptor HTTP maneja 401 redirigiendo al login, pero no renueva automáticamente el access token mediante refresh token.

## Admin frontend

Contiene:

- UsersPage;
- UserModal;
- RolesPage;
- AuditPage.

Los clientes consumen las APIs de identity, permissions y audit.

La navegación muestra Administration solo para admin, pero AppShell entrega actualmente el rol `admin` al Sidebar de forma fija.

Además, la seguridad no puede descansar en el frontend debido a los gaps de autorización backend ya documentados.

## Profile

`ProfilePage` permite:

- modificar nombre;
- apellido;
- email;
- idioma;
- theme;
- timezone;
- avatar;
- contraseña.

El avatar se previsualiza en cliente y se envía como archivo mediante el servicio correspondiente.

La página muestra permisos efectivos agrupados por módulo.

## Notifications frontend

`NotificationCenter` consume la API persistente del backend.

Debe considerarse distinto de notificaciones externas como Teams o Power Automate.

## Operational Panel

`OperationalPanelPage` es un dashboard compositor sin backend propio.

Reutiliza servicios de Production, Maintenance, Work Requests y Quality, soporta día/rango, tolera fallos parciales y refresca cada cinco minutos cuando el periodo termina hoy.

La documentación completa de contratos, semántica de fechas, targets, autorización y limitaciones se mantiene en `modules/operational-panel.md`.

## Placeholders de rutas

`App.tsx` contiene rutas cuyo elemento es texto de "próximamente" o una etiqueta simple.

Entre ellas:

- Maintenance Orders;
- Maintenance Actions;
- Workcenter Detail;
- Plant Settings;
- Settings.

Estas rutas no representan una implementación funcional.

## Árbol backend dentro de frontend

Existe:

`apps/frontend/src/apps/backend/apps/quality/chatbot/management/commands/seed_chatbot_questions.py`.

Los archivos observados en ese árbol están vacíos.

La estructura no forma parte del backend Django ejecutado porque está dentro de `apps/frontend/src`.

Parece un residuo de copia o scaffolding.

Debe eliminarse o justificarse para evitar que un desarrollador confunda esa ruta con `apps/backend/apps/quality/chatbot`, que sí es el backend activo.

## Componentes comunes frontend

`src/components/common` contiene componentes reutilizados para:

- filtros estándar;
- Business Unit;
- workcenter;
- shift;
- date ranges;
- multiselect;
- fullscreen;
- Action Tracker references.

Esta capa debe continuar siendo el lugar preferido para UI transversal antes de duplicar componentes equivalentes en cada módulo.

## Criterio para nuevos módulos

Un módulo no debe pasar a estado Implementado solamente porque exista su carpeta.

Como mínimo debe verificarse:

1. registro en runtime;
2. rutas;
3. contrato API;
4. capa de datos;
5. autorización;
6. frontend conectado, si aplica;
7. configuración necesaria;
8. pruebas mínimas del comportamiento crítico;
9. documentación actualizada.
