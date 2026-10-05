# Notificaciones internas

## Propósito

`apps.notifications` mantiene notificaciones persistentes asociadas a usuarios de platformSSI.

La implementación actual está integrada principalmente con Problem Control y permite representar tanto avisos informativos como tareas pendientes.

## Modelo

La tabla definida es `core_notification`.

| Campo | Responsabilidad |
| --- | --- |
| `recipient` | Usuario destinatario |
| `actor` | Usuario que originó el evento cuando aplica |
| `notification_type` | Tipo lógico del evento |
| `title` | Título |
| `message` | Texto mostrado |
| `module` | Módulo origen |
| `entity_type` | Tipo de entidad relacionada |
| `entity_id` | Identificador de entidad |
| `action_url` | Ruta del frontend relacionada |
| `metadata` | Contexto adicional JSON |
| `event_key` | Clave única de idempotencia |
| `is_task` | Indica si requiere acción |
| `read_at` | Fecha de lectura |
| `resolved_at` | Fecha de resolución |
| `created_at` | Creación |
| `updated_at` | Última actualización |

Una notificación se considera pendiente cuando `is_task` es verdadero y `resolved_at` es nulo.

## Idempotencia

`event_key` es único.

`NotificationService` utiliza `update_or_create` para evitar duplicar eventos equivalentes y para actualizar el estado cuando cambia una asignación.

## Integración con Problem Control

El servicio genera notificaciones cuando un usuario se agrega al equipo de un problema.

También sincroniza asignaciones de acciones de D3, D5, D6 y D7.

Los modelos reconocidos son `ContainmentAction`, `CorrectiveAction`, `VerificationAction` y `PreventionAction`.

Si una acción cambia de responsable, la notificación pendiente del responsable anterior se marca como resuelta.

Si la acción tiene `completion_date`, la notificación se crea o actualiza como resuelta.

Las URLs generadas llevan al problema y al paso correspondiente del flujo.

## API

| Endpoint | Operación |
| --- | --- |
| `GET /api/v1/notifications/` | Listar notificaciones del usuario |
| `POST /api/v1/notifications/read-all/` | Marcar todas como leídas |
| `POST /api/v1/notifications/{id}/read/` | Marcar una notificación como leída |

El listado acepta `scope=all`, `scope=unread` o `scope=pending`.

El parámetro `limit` tiene valor predeterminado 30 y se limita entre 1 y 100.

La respuesta incluye conteos separados de no leídas y tareas pendientes.

## Seguridad

Todos los endpoints requieren autenticación.

La consulta siempre filtra por `recipient=request.user`.

La operación individual de lectura también valida que la notificación pertenezca al usuario actual.

## Frontend relacionado

El frontend contiene `modules/notifications/NotificationCenter.tsx`, `notificationApi.ts` y `types.ts`.

La documentación detallada de comportamiento visual se mantiene en la sección de frontend.

## Alcance actual

Este módulo representa notificaciones internas almacenadas en PostgreSQL.

No debe confundirse con integraciones externas de mensajería o colas utilizadas por otros sistemas. En el código revisado de `apps.notifications` no existe envío directo a Teams, correo o Power Automate.

## Pruebas

El módulo incluye `tests/test_api.py`.

La existencia de estas pruebas cubre una parte del API, pero no implica cobertura completa de todos los eventos de Problem Control.


## Documentación de módulo

Para el flujo completo del centro de notificaciones, polling frontend, lifecycle de tareas y limitaciones actuales, consultar `../modules/notifications.md`.
