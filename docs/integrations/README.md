# Integraciones externas

## Alcance

platformSSI no contiene todos los sistemas de los que depende. El repositorio actúa como capa de aplicación sobre varias fuentes y servicios externos.

Los límites principales son:

| Sistema | Rol | Mecanismo |
| --- | --- | --- |
| Plex | ERP y fuente operacional | Plex ODBC Proxy |
| SQL Server CCS | Q-Wall y datos operativos compartidos | Q-Wall Proxy |
| Action Tracker | Seguimiento de acciones generadas desde indicadores | Tablas CCS y referencias leídas por Q-Wall Proxy |
| Redis | Caché y broker | Servicio Docker |
| PostgreSQL | Persistencia propia | Servicio Docker |

Los secretos y cadenas de conexión no se documentan con valores.

## Plex

### Arquitectura

Django no abre conexiones ODBC a Plex.

El flujo es:

`Django / Celery -> HTTP -> Plex Proxy -> ODBC/DataDirect -> Plex`.

El proxy se ejecuta fuera de Docker, en el host Windows, porque depende del entorno ODBC disponible en esa máquina.

La URL se obtiene de `PLEX_PROXY_URL`.

La autenticación utiliza un Bearer secret obtenido de `PLEX_PROXY_SECRET`.

### Estado del código

La implementación del Plex Proxy no forma parte de este repositorio.

El script `startapp/start_proxy.bat` cambia a un directorio externo al repositorio y ejecuta Uvicorn en el puerto 8001.

Por lo tanto:

- platformSSI contiene clientes y contratos del proxy;
- no contiene la implementación completa de sus consultas ODBC;
- cualquier documentación de SQL Plex exacto requiere revisar también el repositorio del proxy.

### Consumidores principales

Plex es utilizado por:

- Production / Ops Daily Report;
- Quality / COGP;
- Quality / Incoming Inspection;
- Quality / Downtime;
- Maintenance Overview;
- Maintenance Work Requests;
- Maintenance PMP;
- Maintenance Down Equipment;
- Warehouse.

Cada consumidor debe dividir rangos largos mediante helpers compartidos cuando el endpoint pueda exceder las ventanas permitidas por Plex.

### Procesos asíncronos

Incoming Inspection depende de Celery para materializar datos Plex en PostgreSQL.

El script de arranque valida explícitamente que `PLEX_PROXY_SECRET` esté presente dentro del worker antes de continuar.

### Responsabilidad de caché

El proxy no debe asumirse como la única capa de caché.

Muchos módulos almacenan resultados en Redis desde Django con TTLs diferentes según la naturaleza del dato.

La invalidación y versionado de esas claves pertenece al servicio consumidor.

## Q-Wall Proxy

### Arquitectura

El código sí está incluido en el repositorio:

`apps/qwall-proxy`.

Tecnologías:

- FastAPI;
- Pydantic;
- pyodbc;
- SQL Server ODBC Driver;
- Windows Integrated Security.

El proxy se ejecuta en el host y escucha por defecto en el puerto 8002.

Django utiliza:

- `QWALL_PROXY_URL`;
- `QWALL_PROXY_TOKEN`.

### Objetivo

El proxy mantiene el driver SQL Server y la autenticación integrada fuera de los contenedores Django.

El flujo es:

`Django -> HTTP Bearer -> Q-Wall Proxy -> pyodbc -> SQL Server CCS`.

No existe acceso SQL Server directo desde React.

### Health

`GET /health` no requiere Bearer token y devuelve un estado simple.

El resto de endpoints operativos revisados utiliza una dependencia de autenticación Bearer.

### Familias de endpoints

El archivo `main.py` concentra múltiples dominios:

- inspecciones Q-Wall;
- piece flags;
- rejection reports y fotografías;
- part numbers y catálogos;
- asistencia;
- Ley Silla;
- usuarios y catálogos Q-Wall;
- configuración del sistema;
- lot sampling;
- scrap offenders;
- maintenance offenders;
- referencias de Action Tracker.

`scan_rules_router.py` añade CRUD de reglas de escaneo bajo `/scan-rules`.

Esta amplitud convierte al proxy en un integration service compartido y no exclusivamente en un proxy de lectura de Q-Wall.

## SQL Server CCS

CCS es una fuente externa desde la perspectiva de Django, pero platformSSI escribe algunas estructuras específicas mediante el Q-Wall Proxy.

Ejemplos de datos consumidos o administrados:

- `ssi_Inspections`;
- `ssi_Products`;
- `ssi_PartNumbers`;
- `ssi_BusinessUnits`;
- `ssi_Users`;
- `ssi_InspectionPoints`;
- `ssi_FailModes`;
- `ssi_PieceFlagRecords`;
- tablas de asistencia;
- tablas de lot sampling;
- tablas de scan rules;
- outboxes de offenders;
- tablas `ssi_AT_*` de Action Tracker.

La documentación de datos distingue entre ownership de Django/PostgreSQL y ownership externo/compartido en CCS.

## Action Tracker

### Patrón de integración

platformSSI no crea directamente una acción HTTP contra Action Tracker desde los servicios de COGP o Mantenimiento.

El patrón actual es una outbox en CCS.

COGP envía offenders a:

`POST /scrap-offenders/stage`.

Mantenimiento envía offenders a:

`POST /maintenance-offenders/stage`.

El Q-Wall Proxy inserta los registros en tablas de staging de CCS usando un `SourceKey` idempotente.

Un proceso externo puede posteriormente convertir esos registros a items de Action Tracker y actualizar su estado y código.

### Idempotencia

Scrap y Maintenance validan que el `source_key` tenga formato SHA-256.

La inserción SQL usa una comprobación con locks para no crear dos filas con el mismo SourceKey.

### Referencias abiertas

platformSSI recupera acciones abiertas mediante:

`GET /action-tracker/open-actions?source=scrap|maintenance`.

El proxy relaciona outboxes creadas con tablas `ssi_AT_items` y `ssi_AT_estados`.

Solo devuelve items no cerrados ni cancelados.

Para scrap excluye además registros de prueba.

Los consumidores agregan estas referencias a dashboards sin guardarlas en el mismo caché que los datos Plex.

### URL del item

La configuración Django define `ACTION_TRACKER_URL`.

Sin embargo, el endpoint `/action-tracker/open-actions` revisado construye la URL absoluta del item utilizando un host fijo dentro de `qwall-proxy/main.py`.

Por lo tanto, `ACTION_TRACKER_URL` no es actualmente la fuente efectiva para ese enlace.

Debe reemplazarse el host fijo por configuración para permitir cambios de servidor sin editar código.

## Scan Rules

`scan_rules_router.py` mantiene reglas de lectura de escáner directamente en CCS.

El modelo de entrada valida:

- extraction mode;
- field target;
- separator;
- value position;
- fixed length;
- prefix;
- sequence.

Los targets permitidos incluyen campos de serial y un target descartado.

El router mantiene reglas y campos asociados dentro de una transacción SQL.

La conexión del router admite `QWALL_DB_CONN_STR` por variable de entorno.

## Lot Sampling

La configuración y matriz de lot sampling viven en CCS.

El proxy valida:

- BU;
- modo GENERAL o BY_MODEL;
- tamaño mínimo;
- inspection index existente;
- cobertura del tamaño de lote por la matriz;
- modelos válidos de la BU.

Cuando BY_MODEL está habilitado, todos los modelos de la BU deben estar configurados.

Las escrituras se realizan dentro de una transacción y hacen rollback ante error.

## Seguridad de integración

### Configuración sensible

Los valores sensibles ya no se definen como defaults funcionales dentro del código activo.

La configuración se obtiene desde variables de entorno. En el despliegue actual, el archivo `.env` de la raíz actúa como fuente local del servidor y permanece fuera de Git.

Variables relevantes:

- `PLEX_PROXY_SECRET`;
- `QWALL_PROXY_TOKEN`;
- `QWALL_DB_CONN_STR`;
- credenciales PostgreSQL;
- contraseña Redis;
- `DJANGO_SECRET_KEY`;
- credenciales opcionales de Action Tracker.

`.env.example` documenta las claves requeridas sin incluir secretos válidos.

Q-Wall Proxy se ejecuta directamente en Windows, por lo que `apps/qwall-proxy/config.py` carga el `.env` de la raíz sin sobrescribir variables que ya existan en el entorno del proceso. Si faltan `QWALL_PROXY_TOKEN` o `QWALL_DB_CONN_STR`, el proxy falla al iniciar en lugar de utilizar un fallback funcional.

Django exige los secretos de Plex y Q-Wall desde el entorno. La configuración de desarrollo también exige `DJANGO_SECRET_KEY`, `POSTGRES_PASSWORD` y `REDIS_URL`.

Los tokens anteriores no fueron rotados en este cambio por decisión operativa. Por lo tanto, aunque ya no aparezcan en el árbol activo, continúan siendo sensibles mientras sigan válidos y permanezcan accesibles en el historial Git.

### Conexión SQL Server

La cadena completa de SQL Server CCS se obtiene de `QWALL_DB_CONN_STR`.

Tanto `qwall-proxy/main.py` como `scan_rules_router.py` utilizan la misma variable y ya no contienen una conexión funcional de respaldo.

### Errores

Varios endpoints imprimen tracebacks y algunos los colocan en el `detail` de la respuesta HTTP.

Esto puede revelar estructura interna, SQL o información de infraestructura.

Las respuestas al cliente deben usar mensajes controlados y conservar detalles únicamente en logs del servidor.

### CORS y exposición de puertos

La protección de los proxies no debe depender solo de Bearer token.

En producción deben limitarse por firewall/red y no publicarse a redes que no los necesiten.

## Resiliencia

Algunos consumidores que acceden al Q-Wall Proxy intentan `127.0.0.1:8002` si `host.docker.internal` falla.

Este fallback es útil en ciertos contextos del host, pero mezcla topologías de ejecución dentro de la lógica de negocio.

Una configuración explícita por ambiente sería más mantenible.

## Contratos y ownership

Una regla de arquitectura para nuevas integraciones es:

- React consume Django;
- Django consume proxies;
- proxies consumen sistemas externos;
- las credenciales del sistema externo permanecen en la capa proxy;
- el contrato HTTP entre Django y proxy debe estar documentado y probado;
- un cambio de tabla externa no debe propagarse directamente hasta la UI sin una capa de adaptación.
