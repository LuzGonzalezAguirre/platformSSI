# Datos y ownership

## Propósito

platformSSI utiliza más de un sistema de almacenamiento. Este documento define qué tipo de dato pertenece a cada uno y evita tratar todas las tablas visibles como si fueran administradas por Django.

## Sistemas de datos

| Sistema | Ownership principal | Escritura desde platformSSI |
| --- | --- | --- |
| PostgreSQL | platformSSI/Django | Sí |
| SQL Server CCS | Sistemas operativos compartidos y Q-Wall | Sí, mediante Q-Wall Proxy para dominios definidos |
| Plex | ERP | Principalmente lectura mediante Plex Proxy |
| Redis | Infraestructura temporal | Sí, caché/broker |
| Media filesystem | platformSSI | Sí, archivos cargados |

## PostgreSQL

PostgreSQL es la base principal controlada por Django.

Los cambios de esquema deben representarse mediante migrations.

Dominios relevantes documentados:

### Identity

- usuarios;
- roles relacionados mediante apps permissions;
- preferencias de perfil.

### Permissions

- permisos;
- roles;
- role permissions;
- user roles;
- overrides.

### Audit

- auditoría global de sesiones y mutaciones.

### Notifications

- notificaciones persistentes y tareas de usuario.

### Production

- business units;
- weekly targets;
- WIP;
- OEE manual;
- personal local;
- asistencia local;
- overlay CCS de asistencia;
- earned hours;
- Safety settings/incidents/events.

### Quality

PostgreSQL guarda configuración y estado propio, incluyendo:

- targets/configuración;
- COGP materializado;
- mapeos;
- traducciones;
- imágenes;
- Incoming Inspection snapshots/history/sync state;
- SLA y comentarios;
- Downtime assignment snapshots;
- Problem Control y su workflow;
- preguntas/feedback del chatbot predefinido.

### Maintenance

PostgreSQL guarda:

- targets de dashboard;
- Corrective Actions locales;
- comentarios;
- historial.

Los Work Requests y datos de downtime provenientes de Plex no se materializan permanentemente en el módulo de mantenimiento revisado.

## SQL Server CCS

CCS no está administrado por migrations de Django.

El acceso se realiza a través de Q-Wall Proxy.

### Q-Wall base

Tablas observadas en consultas incluyen:

- `ssi_Inspections`;
- `ssi_InspectionResults`;
- `ssi_ResultFailModes`;
- `ssi_Products`;
- `ssi_PartNumbers`;
- `ssi_BusinessUnits`;
- `ssi_Users`;
- `ssi_InspectionPoints`;
- `ssi_FailModes`;
- `ssi_PieceFlagRecords`;
- fotografías y relaciones auxiliares.

### Attendance y Chair Control

El proxy consulta o modifica estructuras de asistencia y descansos.

El repositorio incluye SQL para un paquete Attendance paralelo, pero su backend Django no está conectado actualmente.

La existencia del DDL no implica que el módulo frontend/backend paralelo esté activo.

### Q-Wall settings

CCS contiene configuración operativa modificable desde platformSSI, incluyendo catálogos y system config.

### Lot Sampling

Script versionado:

`scripts/sql/ssi_QWallLotSampling.sql`.

Crea de forma idempotente:

- `ssi_QWallLotSettings`;
- `ssi_QWallLotModelSettings`;
- `ssi_QWallSamplingMatrix`.

El script no sobrescribe celdas existentes de la matriz.

La matriz tiene una discontinuidad explícita entre determinados rangos altos; el propio script documenta que no inventa un rango que no estaba en la tabla fuente.

### Scan Rules

El Q-Wall Proxy administra:

- `quality_pn_scan_rules`;
- `quality_scan_fields`.

Estas tablas son parte del contrato SQL Server del proxy, no modelos Django.

### Offenders

Scrap y Maintenance utilizan outboxes en CCS.

Maintenance tiene DDL versionado en:

`scripts/sql/ssi_MaintenanceOffenderActions.sql`.

La tabla usa `SourceKey` como primary key y mantiene:

- semana;
- equipo;
- área;
- horas;
- count;
- rank;
- processing status;
- attempts;
- tracker code;
- error;
- timestamps.

Los estados permitidos son pending, created y error.

Scrap utiliza un patrón equivalente consumido por el proxy, aunque el script de creación correspondiente no está presente en `scripts/sql` dentro del árbol revisado.

## Action Tracker

Las tablas `ssi_AT_*` viven en CCS.

platformSSI las lee mediante Q-Wall Proxy para mostrar referencias abiertas.

Los módulos COGP y Maintenance escriben primero a outboxes y no deben insertar directamente un item Action Tracker desde Django.

Este desacoplamiento permite separar la detección de offender de la creación del workflow.

## Plex

Plex es la fuente para:

- producción;
- scrap;
- costos;
- yield;
- earned labor;
- Work Requests;
- equipment events;
- PMP;
- Incoming Inspection;
- Warehouse BOM/CTB/Demand.

platformSSI no posee esas tablas.

No deben crearse foreign keys PostgreSQL hacia identificadores Plex.

Cuando es necesario persistir contexto externo, se guarda un snapshot lógico o identificador sin asumir integridad referencial cross-database.

## Redis

Redis se utiliza para dos responsabilidades.

### Caché

Ejemplos:

- datos Plex;
- Q-Wall agregado;
- targets;
- Incoming Inspection dashboard;
- locks de refresh.

Las claves tienen TTL y, en algunos módulos, versionado explícito.

### Celery

Redis funciona como broker.

Los resultados Celery se almacenan mediante `django-celery-results` en PostgreSQL, no únicamente en Redis.

## Media

`MEDIA_ROOT` vive dentro del backend.

Usos relevantes:

- avatar de usuario;
- attachments de Problem Control;
- otros archivos de modelos que utilicen FileField/ImageField.

El directorio media está ignorado por Git.

La base de datos conserva referencias, no sustituye una estrategia de backup de los bytes.

## Reglas de integridad cross-system

No se deben crear relaciones ORM Django hacia CCS o Plex.

Patrones correctos observados:

- `inspector_user_id` + `inspector_name` como snapshot;
- `fail_mode_code` para traducciones;
- `ccs_employee_id` para overlays;
- números de parte/workcenters como claves de negocio;
- `SourceKey` para outboxes.

Estos campos deben tratarse como referencias externas y documentarse con su fuente.

## Migraciones frente a scripts manuales

### Django migrations

Son la fuente normal de cambios PostgreSQL.

### `ops/db`

Contiene reconciliaciones específicas, no el historial canónico completo.

El archivo fechado de agosto de 2026 modifica identity y Safety directamente.

No debe reejecutarse sin comparar primero el estado de migrations.

### `scripts/sql`

Contiene DDL manual de SQL Server.

Estos scripts deben:

- ser idempotentes cuando sea posible;
- declarar base objetivo;
- no almacenar secretos;
- documentar dependencia de tablas existentes;
- ejecutarse fuera de `manage.py migrate`.

## Retención e histórico

No todos los datasets tienen el mismo propósito.

Ejemplos:

- IncomingContainerSnapshot: estado actual, no histórico;
- IncomingContainerHistory: histórico incremental;
- AuditLog: histórico de auditoría;
- Problem attachments/notes: evidencia de workflow;
- Redis: temporal;
- Q-Wall/Plex: histórico controlado por sistema externo.

La documentación de un módulo debe especificar si su tabla es snapshot, histórico, configuración o cache materializado.

## Riesgos de datos

### Esquemas compartidos

CCS es una base compartida.

Un cambio SQL puede afectar aplicaciones fuera de Django.

Los scripts deben revisarse con el owner del sistema antes de ejecutarse.

### Duplicación de fuentes

Un mismo concepto puede existir en más de un sistema, por ejemplo asistencia local, asistencia CCS y paquetes SSI paralelos.

Se debe declarar una fuente canónica antes de sincronizar o migrar.

### Cache stale

Un dato visible desde Redis puede no representar inmediatamente el origen.

Cada módulo documenta su TTL.

Datos configurables que necesitan efecto inmediato deben invalidar caché al escribir.

### Direct SQL

Los scripts manuales pueden dejar el esquema diferente a lo que Django espera.

Después de cualquier reconciliación PostgreSQL se debe verificar:

- `showmigrations`;
- `migrate --plan`;
- estado real del esquema;
- ausencia de migrations pendientes no representadas.
