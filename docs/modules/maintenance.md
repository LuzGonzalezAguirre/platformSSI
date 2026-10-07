# Módulo de Mantenimiento

## Alcance

El módulo de Mantenimiento concentra indicadores operativos obtenidos de Plex, Work Requests, equipos actualmente caídos, programa de mantenimiento preventivo, targets de dashboard, acciones correctivas propias y staging semanal de offenders hacia Action Tracker.

Backend: `apps/backend/apps/maintenance`.

Frontend: `apps/frontend/src/modules/maintenance`.

## Áreas frontend

| Área | Ruta de código |
| --- | --- |
| Overview | `maintenance/overview` |
| Work Requests | `maintenance/work-requests` |
| Down Equipment | `maintenance/down-equipment` |
| PMP | `maintenance/pmp` |
| Corrective Actions | `maintenance/corrective-actions` |

## API

El prefijo global es `/api/v1/maintenance/`.

Endpoints principales:

| Endpoint | Propósito |
| --- | --- |
| `overview/kpis/` | KPIs de mantenimiento |
| `overview/reasons/` | Downtime por razón |
| `overview/detail/` | Detalle por razón |
| `overview/oee-trend/` | Tendencia OEE |
| `overview/downtime-by-month/` | Downtime mensual |
| `overview/oee-live/` | OEE actual/agregado |
| `overview/targets/` | Targets configurables |
| `work-requests/dashboard/` | Dashboard Work Requests |
| `down-equipment/dashboard/` | Equipos actualmente Down |
| `pmp/calendar/` | Calendario PMP |
| `corrective-actions/*` | Acciones correctivas |
| `equipment-catalog/` | Catálogo de equipos |
| `assignee-catalog/` | Usuarios asignables |

## Integración con Plex

Los servicios operativos utilizan Plex proxy mediante `PLEX_PROXY_URL` y autenticación Bearer.

Las consultas largas se dividen con `date_chunks` para respetar la ventana permitida por el ERP.

El módulo no debe conectarse directamente al driver ODBC desde Django.

## Overview

### KPIs

`MaintenanceService.get_kpis` consulta `/maintenance-kpis`.

Cuando el rango cabe en una sola ventana se reutiliza el resultado del proxy.

Cuando requiere varias ventanas, Django suma los campos base y recalcula:

- MTTR;
- MTBF;
- availability.

Fórmulas efectivas:

`MTTR = failure_hours / total_failures`

`MTBF = operating_hours / total_failures`

`availability = operating_hours / (operating_hours + downtime_hours) * 100`

Para MTTR, `failure_hours` se calcula como downtime menos setup, con mínimo cero.

El caché de KPIs es de 600 segundos.

### Downtime reasons

El servicio agrega eventos y horas por razón.

Para rangos divididos en chunks, los resultados se fusionan en Django.

Cada razón incluye porcentaje respecto al total de horas.

TTL: 600 segundos.

### Downtime detail

El detalle por razón se obtiene de `/maintenance-downtime-detail`.

TTL: 300 segundos.

### Downtime by month

El servicio consulta `/maintenance-downtime-by-month` y combina chunks cuando es necesario.

TTL: 600 segundos.

## OEE

`OEELiveView` tiene dos fuentes posibles.

Para una sola fecha, si existe un `production.OEERecord` manual, ese registro tiene prioridad y la respuesta marca `source=manual`.

Para rangos de más de un día siempre se calcula desde Plex y la respuesta marca `source=plex`.

No se mezclan overrides manuales diarios con agregados de periodos múltiples.

### Agregación multi-chunk

Para rangos largos, el servicio suma cantidades y horas base y después recalcula:

`availability = operating_hours / plan_hours`

`performance = ideal_hours_total / operating_hours`

`quality = good_qty / total_qty`

`OEE = availability * performance * quality`

El OEE final se limita a 100%.

El proxy debe devolver campos base suficientes para agregar rangos mayores a una ventana. Si no los devuelve, el backend lanza un error indicando que el proxy necesita actualización.

### Tendencia OEE

Para rangos de hasta 120 días, la tendencia puede consultar periodos diarios.

Para rangos mayores, se utilizan buckets mensuales para evitar una consulta por cada día del año.

El comentario de diseño limita una tendencia anual a aproximadamente una consulta por mes.

La tendencia se cachea una hora.

## Dashboard targets

`MaintenanceDashboardTarget` guarda:

- metric key;
- target;
- operador de comparación;
- labels español/inglés;
- unidad;
- usuario de actualización;
- timestamp.

Comparaciones soportadas:

- `gte`: valor mayor o igual al target;
- `lte`: valor menor o igual al target.

El catálogo se cachea 30 minutos.

Roles permitidos para modificar targets:

- `admin`;
- `plant_manager`;
- `maintenance_engineer`.

La lectura requiere únicamente autenticación.

## Work Requests

`WorkRequestsService` consulta `/work-requests` de Plex y deduplica por `work_request_no`.

Los filtros por BU y workcenter se aplican después de recuperar los datos.

John Deere recibe un tratamiento especial: se clasifica como cliente del grupo Speed en lugar de tratarlo como una BU estándar.

TTL del dataset del dashboard: 300 segundos.

### KPIs y agregaciones

El servicio calcula, entre otros:

- total de work requests;
- scheduled hours;
- maintenance hours;
- porcentaje completado;
- promedio de horas programadas;
- promedio de horas reales;
- eficiencia real contra planeado;
- lead time;
- top failure;
- backlog;
- agrupaciones por status, tipo, equipo, técnico, falla, día y departamento.

El frontend contiene tablas, Pareto de equipos, breakdown de fallas, grid de equipos y KPIs.

Dos componentes del frontend, `MaintenanceTrend.tsx` y `StatusDistribution.tsx`, están presentes pero vacíos en el repositorio revisado.

## Referencias a Action Tracker

El dashboard de Work Requests obtiene acciones abiertas de mantenimiento mediante helpers compartidos de `ssi_common.action_tracker_actions`.

Estas referencias se agregan después de leer el caché de Plex.

La intención es que una acción que cambie en Action Tracker sea visible sin esperar a que expire el caché de cinco minutos del ERP.

Las acciones se relacionan principalmente por equipment ID o por solapamiento del rango semanal.

## Offenders semanales de mantenimiento

`stage_weekly_maintenance_offenders` toma la última semana laboral completa, de lunes a viernes.

El servicio:

1. solicita el Work Requests dashboard para esa semana;
2. agrupa por equipment ID;
3. suma maintenance hours;
4. cuenta work requests;
5. ordena por maintenance hours;
6. selecciona los tres equipos principales;
7. envía cada equipo al Q-Wall proxy.

Endpoint del proxy:

`/maintenance-offenders/stage`.

La clave de idempotencia es un SHA-256 de:

- week start;
- week end;
- equipment ID.

La tarea Celery es `stage_weekly_maintenance_offenders_task`.

La configuración global la programa los sábados a las 07:15.

Tiene dos reintentos con espera de 600 segundos.

## Down Equipment

La vista representa equipos cuyo estado actual es Down.

### Fuente actual

`DownEquipmentService` consulta:

- `GET /maintenance-current-down`;
- `POST /maintenance-down-history`.

El dataset actual tiene TTL de 30 segundos.

El historial tiene TTL de 600 segundos.

### Duración

Cuando Plex entrega `Started_At` y `Plex_Now`, el servicio calcula elapsed minutes usando ambos timestamps Plex.

Después proyecta el inicio a una fecha ISO basada en el reloj local de Django para el navegador.

### Severidad

| Minutos | Severidad |
| ---: | --- |
| < 60 | normal |
| 60-119 | warning |
| 120-239 | high |
| >= 240 | critical |

### KPIs

El payload incluye:

- currently down;
- critical;
- longest minutes;
- longest equipment;
- most affected BU.

El KPI `critical` considera equipos con al menos 120 minutos, por lo que incluye severidad high y critical según la tabla interna.

### Tendencias

El historial se agrupa por día y BU.

La sección de equipos recurrentes solo considera eventos cuya razón sea `Equipment`.

Se muestran como máximo ocho equipos recurrentes.

### RBAC de datos

La vista calcula las BUs efectivas intersectando el filtro solicitado con las BUs permitidas para el usuario.

Si no se solicita BU, puede incluir `unclassified`.

## PMP

PMP utiliza Work Requests de Plex filtrados por el tipo de mantenimiento preventivo configurado en `PLEX_PM_TYPE_KEY`.

El valor por defecto de la clave es 1908.

### Estrategia de consulta

El servicio obtiene un año completo y lo cachea.

El frontend puede navegar por meses sin provocar una consulta Plex por cada mes.

Las consultas anuales se dividen por ventanas ERP y se deduplican por work request number.

TTL del año: 600 segundos.

### Estados normalizados

Los estados Plex se normalizan a:

- complete;
- open;
- hold;
- cancelled.

Un estado desconocido cae a `open` para que permanezca visible como pendiente.

### Métricas

`plan_pct` mide avance contra el plan anual completo.

`ytd_pct` mide cumplimiento solamente sobre PMs que ya vencieron.

Los cancelados se excluyen del denominador de ambas métricas.

Un año futuro sin PM vencidos devuelve `ytd_pct=null`, no cero.

### Clasificación

TULC y Heater Module conservan clasificación por BU.

Speed puede representarse por cliente John Deere.

Lo que no puede clasificarse aparece como `unclassified`.

## Corrective Actions

Este submódulo usa PostgreSQL y no debe confundirse con las acciones externas de Action Tracker.

Modelo principal: `maintenance_corrective_action`.

### Prioridad

- high;
- medium;
- low.

### Estados

- open;
- in_progress;
- pending_validation;
- on_hold;
- closed;
- cancelled.

### Transiciones válidas

`open -> in_progress | cancelled`

`in_progress -> pending_validation | on_hold | cancelled`

`pending_validation -> closed | in_progress`

`on_hold -> in_progress | cancelled`

Closed y cancelled son terminales.

### Reglas

Al crear, el estado siempre se fuerza a `open`.

Para cerrar, debe existir al menos una evidencia textual:

- close notes; o
- un comentario.

Solo se pueden eliminar acciones en estado open o cancelled.

El repositorio registra historial para cambios de:

- status;
- assigned_to;
- priority;
- due_date.

Al cerrar se llenan automáticamente `closed_by` y `closed_at`.

### Roles de escritura

Creación, actualización y eliminación requieren uno de:

- `maintenance_engineer`;
- `supervisor`;
- `admin`;
- `plant_manager`.

La consulta requiere autenticación.

El endpoint para agregar comentarios requiere autenticación, pero `CorrectiveActionService.add_comment` no ejecuta la validación de roles de escritura.

Por lo tanto, cualquier usuario autenticado con acceso al endpoint puede agregar un comentario.

### Métricas

El endpoint de métricas calcula:

- total;
- overdue;
- cycle time promedio;
- distribución por estado;
- distribución por prioridad;
- top 5 equipos por cantidad de acciones.

## Catálogos

El Equipment Catalog se obtiene desde Plex proxy y se cachea una hora.

El Assignee Catalog filtra usuarios activos con rol `maintenance_engineer`.

## Segmentación por Business Unit

Maintenance Overview utiliza un único resolver de alcance:

`get_allowed_bu_for_user(user)`.

Las views construyen un `MaintenanceFilterSerializer`, convierten el request en `FilterContext` y aplican `restricted_to_bu()` antes de llamar a servicios.

La misma política se aplica a:

- KPIs;
- downtime reasons;
- downtime detail;
- downtime by month;
- OEE trend;
- OEE live;
- Work Requests;
- Down Equipment.

El filtro solicitado por el cliente nunca amplía el alcance del usuario: se intersecta con las BUs permitidas.

### Agregaciones

Los agregados de Maintenance se calculan después de segmentar por BU.

El Plex proxy expone contexto de workcenter para:

- KPIs mediante `by_workcenter`;
- downtime reasons mediante `workcenter` y `workcenter_group`;
- downtime detail mediante `Workcenter` y `Workcenter_Group`;
- OEE detail mediante `workcenter`, `workcenter_group`, `operating_hours`, `plan_hours` e `ideal_hours_total`.

platformSSI clasifica esas filas con `resolve_maintenance_bu()`, elimina las que están fuera del scope efectivo y después recalcula los totales.

Esto evita comparar KPIs, reasons y OEE construidos sobre universos de datos distintos.

### OEE manual

`production.OEERecord` representa un valor manual global de planta y no contiene Business Unit.

Por esa razón, el override manual de OEE diario solo se utiliza cuando el scope efectivo incluye todas las BUs. Para un scope parcial, OEE se calcula desde Plex usando las filas segmentadas.

### Estado del resolver

El resolver central todavía devuelve todas las BUs para todos los usuarios mientras no exista una política real de asignación por BU.

La segmentación de Maintenance ya queda preparada para esa política: cuando `get_allowed_bu_for_user()` empiece a devolver un subconjunto, los endpoints anteriores aplicarán el nuevo alcance sin cambios adicionales en sus views.

## Pruebas

Existe `tests/test_down_equipment_service.py`.

Las áreas prioritarias adicionales son:

- OEE multi-chunk;
- Work Requests con clasificación John Deere;
- cálculo PMP;
- transiciones de Corrective Actions;
- permisos de comentarios;
- staging idempotente de offenders semanales.
