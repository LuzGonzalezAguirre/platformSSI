# Calidad: Incoming Inspection y Downtime

## Incoming Inspection

### Arquitectura

Incoming Inspection no consulta Plex durante la petición HTTP normal.

La regla declarada en el código es:

`Plex -> Celery task -> PostgreSQL materializado -> API -> React`.

El único repositorio Plex del módulo es `incoming_inspection_plex_repository.py`, utilizado por tareas Celery.

Esta separación evita que la disponibilidad o latencia del ERP determine directamente el tiempo de respuesta de cada pantalla.

### Snapshot actual

`IncomingContainerSnapshot` refleja el estado actual de contenedores de Incoming Inspection.

La sincronización reemplaza el snapshot completo dentro de una transacción.

Antes de eliminar e insertar se toma un PostgreSQL advisory lock para impedir que dos refresh simultáneos provoquen colisiones del unique key `container_key`.

El snapshot no es histórico.

### Historial

`IncomingContainerHistory` refleja incrementalmente eventos de `Part_v_Container_Change2` para operaciones 10, 11 y 20.

La deduplicación utiliza:

- serial_no;
- change_date;
- operation_no.

La sincronización conserva un watermark mediante `IncomingInspectionSyncState`.

### Overlap del watermark

El sync de historial retrocede seis horas respecto al último watermark.

El comentario técnico explica que este overlap existe porque Plex puede publicar eventos con retraso.

La implementación reconoce que la solución definitiva sería utilizar un watermark basado en una llave de cambio estable; por ahora se utiliza overlap temporal.

### Ventanas de Plex

El repositorio divide consultas históricas en ventanas de 168 días.

El timeout por llamada es 300 segundos.

### Refresh desde UI

`POST incoming-inspection/refresh/` inicia una tarea Celery que ejecuta snapshot e historial.

Redis se utiliza como lock distribuido.

`cache.add` impide que dos pestañas creen simultáneamente dos tareas equivalentes.

El lock y el identificador de tarea tienen TTL de 10 minutos.

`GET incoming-inspection/refresh/{task_id}/` permite consultar el estado.

### Caché de API

| Vista | TTL |
| --- | ---: |
| Dashboard | 90 s |
| KPIs | 90 s |
| Pending backlog | 45 s |

El query parameter `_fresh=1` evita utilizar esos resultados cacheados.

Las claves están versionadas con `CACHE_VERSION` para poder invalidar cambios de forma de payload sin depender de `delete_pattern`.

### Backlog

El backlog pendiente utiliza historial, no snapshot, porque necesita calcular antigüedad.

El snapshot se usa para reconciliación agregada y detección de drift.

El límite de salida del backlog es 2000 filas.

La tolerancia de reconciliación es 10%.

Si el historial y snapshot difieren más que esa tolerancia, el payload marca `drift`.

### SLA

El threshold predeterminado es 48 horas.

La configuración es append-only: cada cambio crea una fila nueva con previous value, usuario y timestamp.

Solamente `admin` y `quality_engineer` pueden modificar el threshold.

Los KPIs calculan compliance comparando el primer evento de recepción con el evento de cierre asociado al serial.

### Acceptance

El estado considerado rechazado es `Hold`.

Para acceptance rate se utiliza el último evento por serial.

### Rejection comments

Los comentarios de lotes rechazados son append-only.

La relación con serial_no es lógica y no una foreign key porque un serial puede aparecer múltiples veces en historial.

### API

Endpoints principales:

- dashboard;
- pending;
- kpis;
- detail;
- sla-config;
- rejected-lots;
- rejected-lots/{serial}/comments;
- user-lookup;
- refresh;
- refresh status.

### Pruebas

Existe `tests/test_incoming_refresh.py`.

Por la naturaleza del módulo, la cobertura debe priorizar locks de refresh, watermark/overlap, deduplicación, reconciliación y cálculo de SLA.

## Downtime de Calidad

### Fuente

Downtime consulta logs de Plex.

El servicio filtra de forma fija:

- `Status = Down`;
- `Reason = Quality`.

Los logs se normalizan de PascalCase a snake_case antes de salir del service.

### Caché

Se cachea únicamente el dataset crudo ya normalizado para el rango solicitado.

TTL: 10 minutos.

Los filtros de BU, workcenter y shift se aplican posteriormente en memoria.

Esto evita crear una entrada de caché diferente para cada combinación de filtros.

### Clasificación

Downtime clasifica por cliente mediante reglas compartidas de `ssi_common`.

El filtro estándar del frontend usa códigos de Business Unit, por lo que el backend traduce esos códigos a cliente antes de filtrar.

Los workcenters no clasificables se agrupan como `Sin clasificar` y se registran en log.

### Resumen

El resumen agrupa por:

`fecha + workcenter`.

Calcula:

- minutos totales;
- número de incidentes;
- inspector efectivo;
- fecha heredada de asignación;
- agregado por cliente;
- participación porcentual.

### Asignación de inspectores

Existen dos niveles persistidos en PostgreSQL.

`DowntimeGroupAssignment` representa una decisión para un grupo o subgrupo.

`DowntimeWorkcenterAssignment` representa un override específico de workcenter.

El inspector se guarda como snapshot de `ssi_Users` de CCS:

- inspector_user_id;
- inspector_name.

No existe foreign key entre PostgreSQL y SQL Server.

### Precedencia

Dentro del mismo día:

`workcenter override > subgroup > group`.

Para Heater Module existe subdivisión por BU resuelta mediante reglas compartidas.

### Herencia

Si no existe decisión aplicable para un día, el resolver busca hacia atrás hasta siete días.

Una fila cuyo inspector es nulo significa explícitamente "sin asignar" y detiene la herencia.

La ausencia de fila es lo único que permite seguir heredando.

El primer día histórico con una decisión aplicable detiene la búsqueda, aunque un día anterior tenga un override más específico.

### Separación del caché

Las asignaciones de inspector no se incluyen en el caché de logs Plex.

Se resuelven en PostgreSQL después de obtener los logs.

Esto permite que un cambio de inspector sea visible inmediatamente sin esperar los diez minutos del dataset externo.

### API

| Endpoint | Uso |
| --- | --- |
| `downtime/logs/` | Logs filtrados |
| `downtime/summary/` | Resumen por fecha/workcenter |
| `downtime/trend/` | Tendencia |
| `downtime/workcenters/` | Catálogo de workcenters |
| `downtime/assignments/` | Árbol y escritura de asignaciones |

Logs y summary restringen el FilterContext a las BUs permitidas para el usuario.

### RBAC de asignaciones

`DowntimeAssignmentsView` aplica autorización explícita en backend.

Política:

- GET/HEAD/OPTIONS: cualquier usuario autenticado puede consultar el árbol de asignaciones;
- PUT: únicamente `admin`, `quality_engineer` o `supervisor`;
- superuser puede escribir sin depender de un rol asignado.

La política se implementa mediante `CanWriteDowntimeAssignments` y consulta los roles reales asociados al usuario.

El endpoint mantiene separación entre lectura y escritura: un usuario autenticado puede visualizar asignaciones sin recibir capacidad para reemplazarlas.

La cobertura automática incluye un rol sin privilegios de escritura, los tres roles autorizados y superuser.

## Trabajo relacionado

`sync_downtime_workcenters` existe como tarea Celery para actualizar el catálogo de workcenters.

No se debe asumir que una tarea está programada periódicamente solo porque exista; la programación efectiva debe verificarse en Celery Beat.
