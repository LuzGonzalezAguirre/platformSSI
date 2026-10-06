# Módulo de Calidad

## Alcance

El dominio de Calidad es el módulo funcional más amplio de platformSSI. Agrupa análisis de Q-Wall, COGP y scrap, reportes de rechazo, downtime de calidad, Incoming Inspection, Problem Control, catálogos de falla, reglas de escaneo, configuración de Q-Wall y un asistente de preguntas predefinidas.

El backend se encuentra principalmente en `apps/backend/apps/quality`.

El frontend se distribuye entre:

- `apps/frontend/src/modules/quality`
- `apps/frontend/src/modules/incoming-inspection`
- `apps/frontend/src/modules/qwall-settings`

## Fuentes de datos

Calidad combina tres categorías de datos.

| Fuente | Responsabilidad |
| --- | --- |
| PostgreSQL | Configuración propia, Problem Control, catálogos locales, traducciones, snapshots materializados y estado de aplicación |
| Plex | Scrap, costos, producción, downtime y datos de Incoming Inspection |
| SQL Server CCS | Inspecciones Q-Wall, catálogos Q-Wall, usuarios Q-Wall, configuración operativa y lot sampling |

Las consultas a Plex se realizan mediante Plex proxy.

Las operaciones sobre CCS se realizan mediante Q-Wall proxy.

La interfaz React nunca consulta directamente Plex ni SQL Server.

## Rutas principales

El prefijo global del módulo es `/api/v1/quality/`.

Los grupos de endpoints principales son:

| Grupo | Propósito |
| --- | --- |
| `qwall/*` | Dashboard, tendencias, Pareto y resúmenes Q-Wall |
| `qwall/settings/*` | Administración de configuración y catálogos Q-Wall |
| `cogp/*` | COGP, Pareto, mapping, scrap rate y offenders |
| `downtime/*` | Logs, resumen, tendencia y asignación de inspectores |
| `incoming-inspection/*` | Dashboard, backlog, SLA, detalle y sincronización |
| `problems/*` | Problem Control y flujo 8D |
| `rejection-report/*` | Reporte de rechazos y PDF |
| `catalog/*` | Catálogo de modos de falla |
| `chatbot/*` | Respuestas predefinidas, feedback y sugerencias |
| `scan-rules/*` | Reglas de escaneo Q-Wall |
| `targets/*` | Targets de calidad |

La documentación específica se mantiene en documentos separados para Q-Wall, Chatbot Q-Wall, COGP, Problem Control e Incoming Inspection/Downtime.

## Dashboard y targets generales

El frontend contiene `QualityDashboard.tsx` y `QualityPanelPage.tsx`.

`QualityService` consume:

- `/quality/scrap-detail/`
- `/quality/targets/`

Los targets de calidad pueden definirse por business unit o workcenter.

El helper del frontend resuelve primero un target específico de workcenter, luego un target de BU y, si ninguno existe, utiliza como fallback 95% de yield mínimo y 2% de scrap máximo.

Este fallback pertenece actualmente al frontend y no debe tratarse como una configuración centralizada del backend.

## Reporte de rechazos

El reporte utiliza `RejectionService` y `RejectionRepository` para construir un árbol de rechazos a partir de datos Q-Wall.

Endpoints:

| Endpoint | Uso |
| --- | --- |
| `rejection-report/` | Árbol de rechazos |
| `rejection-photo/{inspection_id}/` | Fotografía asociada |
| `rejection-report/pdf/` | Exportación PDF |

El reporte acepta español e inglés.

La exportación PDF incorpora fotografías cuando existen.

El frontend tiene una vista dedicada `RejectionReportPage.tsx`.

## Catálogo de fallas

`FailureCatalogService` puede construir un catálogo a partir de inspecciones históricas o solicitar la estructura completa al proxy mediante `/catalog/structure`.

La jerarquía completa es:

`Business Unit -> Inspection Point -> Fail Mode`.

Las imágenes asociadas a modos de falla se almacenan en PostgreSQL.

Las traducciones también se almacenan en PostgreSQL y se enlazan lógicamente por `fail_mode_code`; no existe una foreign key cruzada hacia CCS.

## Chatbot de Calidad

El submódulo `apps.quality.chatbot` no es un chatbot generativo.

La implementación actual trabaja con `ChatbotQuestionTemplate`, un registro de funciones permitidas y llamadas a servicios internos.

Cada template define:

- módulo;
- clave de pregunta;
- pregunta en español e inglés;
- plantilla de respuesta;
- tipo de respuesta;
- referencia a una función registrada;
- filtros requeridos;
- roles permitidos;
- parámetros configurables.

Actualmente el catálogo de módulos del modelo contiene únicamente `qwall`.

`ChatbotService` precarga respuestas ejecutando solo funciones presentes en `CHATBOT_SERVICE_REGISTRY`.

Si faltan filtros obligatorios, la pregunta se excluye de la respuesta.

Si un template apunta a una función inexistente o la función falla, el servicio omite esa respuesta y registra el problema.

También existen endpoints para feedback y sugerencias.

Para el contrato completo del chatbot, registry, modelos, frontend y limitaciones actuales, consultar `quality-chatbot.md`.

## Código histórico

Dentro del módulo permanecen archivos como:

- `models_old.py`
- `serializers_old.py`
- `views_OLD_BACKUP.py`

Estos archivos no deben utilizarse para inferir el comportamiento actual mientras no estén importados por la configuración vigente.

Su presencia constituye deuda de limpieza del repositorio.

## Autorización

El dominio Quality utiliza una política RBAC común basada en permisos efectivos `quality.view/create/edit/delete`.

La autoridad se resuelve mediante `PermissionService`, por lo que se respetan:

- permisos heredados de uno o más roles;
- overrides individuales grant/revoke;
- acceso total de superuser.

La política se aplica en el registro de rutas mediante `quality_view()` y `QualityModulePermission`.

### Matriz común

| Operación | Permiso |
| --- | --- |
| GET, HEAD, OPTIONS | `quality.view` |
| POST que crea un registro | `quality.create` |
| PUT/PATCH | `quality.edit` |
| DELETE | `quality.delete` |

Esta matriz cubre Q-Wall reports, Q-Wall Settings, scan rules, COGP, Incoming Inspection, targets, scrap, rechazo, catálogos, chatbot, Downtime de consulta y el CRUD general de Problem Control.

### POST con semántica no CRUD

Algunos POST se mapean explícitamente:

- refresh de Incoming Inspection: `quality.edit`;
- lookup de usuarios de Incoming Inspection: `quality.view`;
- submit, close y overrides de workflow de Problem Control: `quality.edit`.

### Excepciones justificadas

Problem Control conserva autorización por asignación para los endpoints de aprobación. Un usuario de Manufacturing, Production o Maintenance asignado como aprobador puede participar en su sección aunque no tenga permisos generales de edición de Quality. Esta excepción evita acoplar aprobaciones interdepartamentales al rol Quality.

Downtime Assignments conserva la política definida en SEC-003 para escritura:

- lectura: `quality.view`;
- PUT: `admin`, `quality_engineer`, `supervisor` o superuser.

Los filtros por Business Unit siguen siendo una capa adicional de alcance de datos. Tener `quality.view` autoriza el endpoint, pero no elimina una restricción de BU cuando el submódulo la aplique.

La UI puede ocultar controles según permisos, pero la decisión final de autorización permanece en backend.

## Pruebas

Existe cobertura específica para algunos flujos, por ejemplo `tests/test_incoming_refresh.py`.

No existe evidencia en el árbol revisado de una suite integral que cubra todos los submódulos de Calidad.

Las prioridades de prueba son:

1. clasificación de BUs y clientes;
2. cálculos COGP y scrap rate;
3. sincronización incremental de Incoming Inspection;
4. flujo de aprobación y rechazo de Problem Control;
5. agregaciones Q-Wall;
6. autorización de settings y acciones administrativas;
7. resolución jerárquica de inspectores de Downtime.
