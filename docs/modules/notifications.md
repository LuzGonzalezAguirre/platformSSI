# Módulo de Notificaciones

## Propósito

El módulo de Notificaciones proporciona avisos persistentes dentro de platformSSI para cada usuario autenticado.

Su implementación actual cubre dos conceptos diferentes:

1. notificaciones informativas;
2. tareas pendientes que requieren una acción del usuario.

El backend se encuentra en:

`apps/backend/apps/notifications`

El frontend se encuentra en:

`apps/frontend/src/modules/notifications`

El componente visual se monta desde:

`apps/frontend/src/components/layout/TopBar.tsx`

Este módulo representa notificaciones internas de la plataforma. No incluye Teams, correo, Power Automate ni otras integraciones externas de mensajería.

## Estado

Estado actual: implementado.

El módulo está registrado en Django, publica rutas bajo `/api/v1/notifications/` y el centro de notificaciones está montado en el TopBar para las sesiones autenticadas.

La integración funcional observada está concentrada en Problem Control.

## Modelo de datos

Modelo principal:

`Notification`

Tabla:

`core_notification`

Campos relevantes:

| Campo | Uso |
| --- | --- |
| `recipient` | Usuario destinatario |
| `actor` | Usuario que originó el evento |
| `notification_type` | Tipo lógico del evento |
| `title` | Título visible |
| `message` | Mensaje visible |
| `module` | Dominio origen |
| `entity_type` | Tipo de entidad relacionada |
| `entity_id` | Identificador de entidad |
| `action_url` | Ruta frontend a abrir |
| `metadata` | Contexto adicional JSON |
| `event_key` | Clave única para idempotencia |
| `is_task` | Indica si representa una tarea |
| `read_at` | Fecha de lectura |
| `resolved_at` | Fecha de resolución |
| `created_at` | Fecha de creación |
| `updated_at` | Última modificación |

## Estado leído y estado resuelto

Leer una notificación y resolver una tarea son estados diferentes.

Una notificación está sin leer cuando:

`read_at IS NULL`

Una tarea está pendiente cuando:

`is_task = true AND resolved_at IS NULL`

La propiedad `is_pending` del modelo representa esta segunda condición.

Marcar una notificación como leída no modifica `resolved_at`.

Por tanto, una tarea puede estar:

- sin leer y pendiente;
- leída y pendiente;
- leída y resuelta;
- sin leer y resuelta, dependiendo del evento que la actualizó.

## Idempotencia

`event_key` es único.

`NotificationService` utiliza `update_or_create` para que el mismo evento lógico no genere filas duplicadas.

Ejemplos de claves:

`problem-team:{problem_id}:{recipient_id}`

`problem-action:{model_name}:{action_id}:{recipient_id}`

La clave forma parte del contrato interno del servicio y permite actualizar una notificación existente cuando cambia el estado de la entidad origen.

## Integración con Problem Control

La integración se realiza mediante `NotificationService`.

### Miembros del equipo

Cuando se crea un Problem Control, `ProblemService.create_problem` llama a:

`NotificationService.notify_team_members(...)`

El servicio crea una notificación informativa para los miembros del equipo.

El actor no recibe una notificación para sí mismo.

Al editar un problema, se compara el equipo anterior con el equipo nuevo.

Solo los nuevos miembros reciben una nueva asignación mediante:

`new_team_member_ids - old_team_member_ids`

Estas notificaciones usan:

- `notification_type = problem_team_assigned`;
- `module = problem_control`;
- `entity_type = problem`;
- `is_task = false`.

La URL dirige al problema en el paso D2.

### Acciones D3, D5, D6 y D7

Los tipos soportados son:

| Modelo | Paso | Etiqueta |
| --- | --- | --- |
| `ContainmentAction` | D3 | Containment Action |
| `CorrectiveAction` | D5 | Corrective Action |
| `VerificationAction` | D6 | Verification Action |
| `PreventionAction` | D7 | Prevention Action |

Al crear una acción, la vista llama a:

`NotificationService.sync_action_assignment(action, actor=request.user)`

Al actualizarla, conserva el responsable previo y vuelve a sincronizar.

Al eliminarla, llama a:

`NotificationService.resolve_action(obj)`

## Cambio de responsable

Cuando una acción cambia de responsable:

1. se busca la notificación pendiente del responsable anterior;
2. se marca como resuelta;
3. se crea o actualiza la notificación del responsable nuevo.

El historial anterior permanece en base de datos.

No se elimina la fila.

## Acción completada

Si la acción tiene `completion_date`, `sync_action_assignment` establece `resolved_at`.

Por tanto, la resolución de la notificación deriva del estado del objeto de Problem Control.

El usuario no dispone de un endpoint genérico para marcar una tarea como resuelta manualmente.

## Eliminación de una acción

Antes de eliminar una acción D3, D5, D6 o D7, la vista llama a `resolve_action`.

El servicio marca como resueltas todas las notificaciones pendientes cuyo `event_key` corresponda a esa acción.

Después se elimina la entidad de Problem Control.

## API

Prefijo:

`/api/v1/notifications/`

| Método | Endpoint | Uso |
| --- | --- | --- |
| GET | `/api/v1/notifications/` | Obtener feed |
| POST | `/api/v1/notifications/read-all/` | Marcar todas como leídas |
| POST | `/api/v1/notifications/{id}/read/` | Marcar una como leída |

Todos los endpoints requieren `IsAuthenticated`.

## Feed

`NotificationListView` filtra siempre por:

`recipient=request.user`

Scopes soportados por backend:

- `all`;
- `unread`;
- `pending`.

Comportamiento:

### all

No agrega filtro adicional.

### unread

Filtra:

`read_at IS NULL`

### pending

Filtra:

`is_task = true AND resolved_at IS NULL`

## Límite

El query param `limit`:

- default: 30;
- mínimo: 1;
- máximo: 100.

Si el valor no es numérico, vuelve a 30.

No se utiliza paginación DRF.

Se toma:

`queryset[:limit]`

## Conteos

La respuesta incluye conteos globales para el usuario:

`unread`

`pending`

Los conteos se calculan independientemente del scope actual.

Esto permite que el badge y el tab de pendientes mantengan sus cifras aunque la lista esté filtrada.

## Contrato de respuesta

La respuesta contiene:

```text
results[]
counts
  unread
  pending
```

Cada item serializado incluye:

- id;
- notification_type;
- title;
- message;
- module;
- entity_type;
- entity_id;
- action_url;
- metadata;
- is_task;
- is_pending;
- read_at;
- resolved_at;
- created_at.

`actor`, `event_key` y `updated_at` no se exponen por este serializer.

## Marcar como leída

`POST /notifications/{id}/read/`

La consulta incluye tanto:

- `pk`;
- `recipient=request.user`.

Un usuario no puede marcar como leída una notificación de otro usuario.

Si no existe una coincidencia, responde 404.

`mark_read()` solo escribe `read_at` si todavía es nulo.

## Marcar todas como leídas

`POST /notifications/read-all/`

Actualiza todas las notificaciones no leídas del usuario actual.

No modifica:

- `is_task`;
- `resolved_at`.

La respuesta informa cuántas filas fueron actualizadas.

## Frontend

Componente:

`NotificationCenter.tsx`

Cliente:

`notificationApi.ts`

Tipos:

`types.ts`

El componente está montado dentro de `TopBar`.

Como TopBar forma parte de `AppShell`, el centro está disponible en todas las páginas autenticadas que usan el shell principal.

## Badge

El botón muestra el número de notificaciones sin leer.

Si el conteo supera 99 se muestra:

`99+`

El conteo se obtiene de `counts.unread`.

## Tabs

La UI expone actualmente dos vistas:

- Notifications;
- Pending.

Los scopes enviados son:

- `all`;
- `pending`.

Aunque el backend soporta `scope=unread`, la interfaz actual no ofrece un tab exclusivo de no leídas.

## Polling

El feed usa TanStack Query.

Configuración:

`refetchInterval = 45_000`

`refetchOnWindowFocus = true`

Por tanto, el navegador:

- actualiza el feed cada 45 segundos;
- vuelve a consultar al recuperar foco.

El polling ocurre mientras `NotificationCenter` está montado, no únicamente cuando el panel está abierto.

## Query keys

La key es:

`["notifications", scope]`

Cambiar entre `all` y `pending` mantiene entradas separadas en caché.

Después de:

- marcar una como leída;
- marcar todas como leídas;

se invalida el prefijo:

`["notifications"]`

Esto fuerza actualización de todos los scopes cacheados.

## Apertura de notificación

Al hacer click:

1. si está sin leer, se lanza `markRead.mutate(id)`;
2. el panel se cierra;
3. si existe `action_url`, React Router navega a esa ruta.

La navegación no espera a que termine la mutation de lectura.

## Presentación

Cada item muestra:

- icono;
- título;
- mensaje;
- metadata secundaria;
- fecha/hora;
- indicador de no leída;
- indicador visual de pendiente.

Las tareas pendientes utilizan un icono diferente.

## Metadata visible

El texto secundario utiliza:

`metadata.step || "Problem Control"`

Esto funciona para la integración actual porque las notificaciones implementadas pertenecen a Problem Control.

Sin embargo, si en el futuro se reutiliza el módulo para otra área y la notificación no contiene `metadata.step`, la UI seguirá mostrando "Problem Control".

La presentación debería derivarse de `module`, `notification_type` o metadata explícita antes de ampliar el alcance.

## Idioma

El componente recibe el idioma actual desde TopBar.

Usa:

- `es-MX` para español;
- `en-US` para inglés.

Los labels de UI cambian mediante condicionales locales.

Los campos `title` y `message` vienen del backend.

Las notificaciones de Problem Control actuales se construyen en inglés en `NotificationService`.

Por tanto, cambiar el idioma de la UI no traduce el contenido persistido de notificaciones existentes.

## Seguridad

Los endpoints usan `IsAuthenticated`.

Además, cada operación está scoped por `request.user`.

Esto evita acceso cruzado al feed y a la operación de lectura.

El módulo no permite consultar arbitrariamente las notificaciones de otro usuario.

## Integridad y ciclo de vida

Las notificaciones no se eliminan automáticamente al leerse o resolverse.

No existe en el código revisado:

- job de retención;
- archivado;
- purge periódico;
- endpoint de delete.

Esto permite conservar historial, pero implica crecimiento continuo de `core_notification`.

## Canales externos

El módulo no realiza:

- envío de Teams;
- correo;
- SMS;
- webhook;
- Power Automate.

Esos mecanismos deben documentarse en su integración correspondiente.

Una misma acción de negocio puede eventualmente producir tanto una notificación interna como una externa, pero deben tratarse como canales independientes.

## Pruebas existentes

`apps/backend/apps/notifications/tests/test_api.py` cubre al menos:

1. el feed solo devuelve notificaciones del usuario autenticado;
2. los conteos unread/pending;
3. marcar como leída no resuelve una tarea;
4. un usuario no puede marcar como leída la notificación de otro.

No se observó una suite frontend específica junto a `modules/notifications`.

## Cobertura pendiente recomendada

Escenarios relevantes adicionales:

1. `scope=unread`;
2. `scope=pending`;
3. límites 1, 30 y 100;
4. limit inválido;
5. `read-all`;
6. idempotencia por `event_key`;
7. alta de miembro de equipo;
8. no notificar al actor;
9. cambio de responsable;
10. completion_date;
11. eliminación de acción;
12. polling frontend;
13. invalidación de query cache;
14. navegación por `action_url`;
15. comportamiento con notificaciones de módulos distintos a Problem Control.

## Limitaciones actuales

### Integración funcional concentrada en Problem Control

El modelo es genérico, pero la lógica generadora observada está orientada a Problem Control.

### Backend y frontend no exponen los mismos scopes

Backend soporta `unread`.

Frontend solo tipa y utiliza:

- `all`;
- `pending`.

### Contenido persistido no localizado

Los textos generados por `NotificationService` son strings persistidos.

No se regeneran cuando el usuario cambia idioma.

### Fallback visual específico de Problem Control

El frontend muestra "Problem Control" cuando `metadata.step` no existe.

### Sin política de retención

No existe limpieza automática de notificaciones históricas.

### Sin stream en tiempo real

La actualización usa polling de 45 segundos.

No existen WebSockets, Server-Sent Events ni push interno.

## Regla de extensión

Para agregar un nuevo origen de notificaciones:

1. definir un `notification_type` estable;
2. definir una estrategia de `event_key` idempotente;
3. establecer `module`, `entity_type` y `entity_id`;
4. definir `action_url`;
5. decidir si es informativa o task;
6. definir cuándo se resuelve;
7. mantener scope por recipient;
8. agregar pruebas;
9. evitar acoplar la UI a un único módulo;
10. actualizar esta documentación.

La creación de notificaciones debe ocurrir desde la capa de dominio que conoce el evento, no desde el componente frontend.
