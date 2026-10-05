# Q-Wall Proxy

## Propósito

`apps/qwall-proxy` es el servicio de integración Windows para SQL Server CCS.

Aunque conserva el nombre Q-Wall, actualmente sirve a más dominios que Q-Wall y funciona como gateway de datos CCS para platformSSI.

## Ejecución

Entrada principal:

`apps/qwall-proxy/main.py`.

Router adicional:

`apps/qwall-proxy/scan_rules_router.py`.

El script del host ejecuta un worker Uvicorn y reinicia el proceso si termina.

El servicio no está declarado como contenedor en `docker-compose.yml`.

## Autenticación

FastAPI usa HTTP Bearer.

El token se compara con `QWALL_PROXY_TOKEN`.

El endpoint de salud es la excepción y no requiere autenticación.

La configuración actual contiene un default válido en código. Debe eliminarse y rotarse como parte del endurecimiento de secretos.

## Conexiones

El servicio abre conexiones pyodbc por operación.

`main.py` utiliza una cadena de conexión integrada definida en código.

El router de scan rules permite obtener la cadena desde `QWALL_DB_CONN_STR`.

No existe actualmente un único helper de conexión compartido por todos los routers.

## Lectura Q-Wall

Las consultas de reportes combinan tablas de inspecciones, resultados, productos, números de parte, usuarios, fail modes y fotografías.

El proxy devuelve diccionarios serializables y convierte fechas a ISO cuando es necesario.

La agregación de indicadores de dashboard ocurre principalmente en Django, no en este proxy.

## Attendance

El proxy contiene endpoints para:

- attendance daily;
- check-in;
- check-out;
- overtime;
- today status;
- records;
- KPIs;
- employees.

Algunas operaciones llaman stored procedures de CCS.

Otras realizan SQL directo.

El endpoint daily puede hacer MERGE de registros manuales.

## Chair Control

El proxy contiene endpoints para:

- KPIs;
- breaks;
- daily chart;
- shift chart.

Estos endpoints son consumidos por la implementación activa de Ley Silla en el módulo Production y por el paquete SSI paralelo.

## Catálogos y Settings

El proxy permite leer o modificar:

- business units;
- usuarios;
- roles Q-Wall;
- números de parte;
- inspection points;
- fail modes;
- relaciones fail mode / inspection point;
- system config;
- lot sampling.

Django aplica algunas restricciones de rol antes de invocar estas operaciones, pero el proxy confía únicamente en su Bearer token y no conoce el usuario final ni sus roles.

Por tanto, el proxy es un boundary de servicio, no la capa final de autorización de usuario.

## Scan Rules

El router dedicado utiliza dos tablas:

- `quality_pn_scan_rules`;
- `quality_scan_fields`.

Los schemas Pydantic validan valores permitidos antes de ejecutar SQL.

Las operaciones de regla y campos relacionados se ejecutan de forma transaccional.

## Outboxes

### Scrap

`/scrap-offenders/stage` inserta en la outbox de offenders de scrap.

La inserción es idempotente por SourceKey.

La respuesta inicial deja el procesamiento como pending.

### Maintenance

`/maintenance-offenders/stage` usa el mismo patrón para equipos de mantenimiento.

El rango válido de rank es 1 a 3.

### Open Action references

`/action-tracker/open-actions` consulta los items de Action Tracker que ya fueron creados a partir de esas outboxes.

No devuelve acciones cerradas ni canceladas.

## Lot Sampling

La matriz y configuraciones se consultan directamente desde CCS.

Las escrituras de configuración:

- validan la BU;
- validan el inspection index;
- comprueban que el tamaño exista en la matriz;
- verifican part numbers de la BU;
- insertan o actualizan settings;
- reemplazan model settings;
- hacen commit o rollback.

## Riesgos técnicos

### Archivo monolítico

`main.py` supera ampliamente el tamaño razonable de un gateway simple y agrupa dominios distintos.

Se recomienda dividirlo en routers y servicios por dominio:

- qwall reporting;
- qwall settings;
- attendance;
- chairs;
- action tracker outbox;
- lot sampling;
- catalogs.

### SQL inline

La mayoría de queries viven directamente dentro de handlers FastAPI.

Esto dificulta pruebas unitarias y reutilización.

Una capa repository por dominio permitiría probar transformación y transacciones por separado.

### Gestión de conexión

Las conexiones se abren y cierran manualmente.

Debe considerarse context management consistente para garantizar cierre incluso ante excepción.

### Tracebacks al cliente

Algunos handlers responden con el traceback completo.

Debe eliminarse de respuestas HTTP.

### Configuración sensible

No debe existir ningún secret ni conexión funcional como default versionado.

### URLs absolutas

La generación de enlaces de Action Tracker usa actualmente un host absoluto hardcodeado.

Debe salir de configuración.

## Pruebas

El proxy contiene `tests/test_lot_sampling.py`.

No se observó una suite equivalente para todos los grupos de endpoints.

Las áreas críticas para pruebas son:

- autenticación;
- transacciones de settings;
- staging idempotente;
- Action Tracker references;
- scan rules;
- errores SQL;
- serialización de fechas;
- cierre de conexiones.
