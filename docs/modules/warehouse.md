# Módulo de Warehouse

## Alcance

Warehouse expone tres funciones principales basadas en Plex:

- Demand;
- BOM Explorer;
- Clear to Build.

Backend: `apps/backend/apps/warehouse`.

Frontend: `apps/frontend/src/modules/warehouse`.

El módulo no mantiene modelos Django propios en el estado revisado.

## Arquitectura

El flujo es:

`React -> Django REST -> WarehouseService -> PlexClient -> Plex proxy -> Plex`.

`PlexClient` es la única capa del módulo que conoce directamente el proxy HTTP.

`WarehouseService` agrega caché y oculta el cliente de integración al resto de la aplicación.

## API

El prefijo global es `/api/v1/warehouse/`.

| Endpoint | Propósito |
| --- | --- |
| `parts/{part_no}/revisions/` | Revisiones disponibles |
| `parts/{part_no}/bom/{revision}/` | BOM jerárquico |
| `parts/{part_no}/ctb/{revision}/` | Clear to Build |
| `demand/` | Demanda por cliente y status |

Todos los endpoints requieren autenticación.

No se aplica una clase de permiso específica del módulo Warehouse en estas views.

## Caché

`WarehouseService` usa el backend de caché de Django.

El TTL se obtiene de `PLEX_CACHE_TTL`, cuyo valor base actual es 300 segundos.

Las claves se generan como MD5 de un JSON estable con operación y parámetros.

Esto separa correctamente resultados por:

- número de parte;
- revisión;
- need;
- customer;
- release status.

## Manejo de errores

`PlexClient` utiliza httpx con timeout de 60 segundos.

Convierte timeouts, errores HTTP y errores inesperados en `PlexProxyError`.

Las views traducen estos errores a HTTP 502.

## Part Revisions

`get_part_revisions` llama `POST /part-revisions` del Plex proxy.

Entrada:

- part number.

Salida:

- Part_No;
- Revision;
- Part_Name.

El frontend primero consulta revisiones y selecciona inicialmente la primera revisión devuelta.

La UI no determina por sí sola cuál revisión es activa; depende del orden y metadatos entregados por el proxy.

## BOM Explorer

`get_bom_hierarchy` llama `POST /bom-hierarchy`.

Entradas:

- part number;
- revision;
- max levels.

El cliente utiliza `max_levels=10` por defecto.

La respuesta serializada incluye:

- level;
- original part number;
- original part name;
- part number + revision;
- part name;
- quantity;
- unit;
- note;
- BOM path.

El frontend representa cada nivel con una tabla y permite visualizar la ruta jerárquica de cada componente.

## Clear to Build

`get_bom_ctb` llama `POST /bom-ctb`.

Entradas:

- part number;
- revision;
- need;
- max levels.

Defaults en el cliente:

- `need=500`;
- `max_levels=10`.

La view también usa 500 como valor predeterminado cuando el query parameter `need` no está presente.

El cálculo de CTB pertenece al Plex proxy. Django no recalcula la disponibilidad.

## Campos CTB documentados por el serializer

`BomCtbSerializer` expone:

- level;
- root_part_no_rev;
- part_no_rev;
- part_name;
- bom_qty;
- unit;
- need;
- ohymv;
- wip;
- inv;
- ohnv;
- ctb;
- bom_path;
- note.

El significado operacional de los buckets de inventario debe mantenerse alineado con el contrato del proxy, ya que Django únicamente los transporta.

## Comportamiento del frontend CTB

La pantalla calcula KPIs visuales sobre las filas recibidas:

- total components;
- BOM depth;
- unique parts;
- requested need;
- cantidad de componentes con CTB Yes/No;
- porcentaje de filas ready.

La condición de "fully ready" del frontend es que no exista ninguna fila con `ctb=No`.

Este porcentaje es una métrica visual de filas de componentes, no una nueva fórmula de disponibilidad del backend.

## Revisión activa y BOM stale

El frontend espera además:

- `is_latest_revision`;
- `active_revision`.

Con esos campos muestra una advertencia cuando el BOM referencia una revisión distinta de la revisión activa.

Sin embargo, `BomCtbSerializer` del backend no declara estos dos campos.

Django REST Framework serializa únicamente los campos declarados, por lo que esos metadatos pueden descartarse aunque Plex proxy los devuelva.

Existe por tanto una desalineación de contrato entre backend y frontend que debe corregirse en un cambio funcional separado.

## Demand

`get_demand` llama `POST /demand` del Plex proxy.

Filtros:

- customer number opcional;
- release status.

Status predeterminado: `Open`.

El frontend permite:

- Open;
- History;
- All.

La respuesta incluye información de PO/release, parte, customer part, cantidades listas y WIP, fechas de ship/due, cantidad del release, shipped, balance, release status y release type.

Las filas se agrupan visualmente por customer.

## Catálogo de clientes del frontend

La lista de clientes mostrada por Demand está definida de forma estática en `warehouse.service.ts`.

El backend no valida la selección contra esa lista; acepta el customer number recibido y lo reenvía al proxy.

Esto implica que agregar o cambiar clientes visibles requiere actualmente un cambio de frontend.

Una evolución posterior debería considerar un catálogo dinámico si la lista necesita administrarse sin despliegue.

## Ownership de cálculo

Django no implementa las consultas ODBC ni las fórmulas de BOM/CTB/Demand.

La responsabilidad se divide así:

| Capa | Responsabilidad |
| --- | --- |
| Frontend | Selección, filtros y presentación |
| Django view | Validación básica y respuesta HTTP |
| WarehouseService | Caché |
| PlexClient | Contrato HTTP con proxy |
| Plex proxy | Consulta y transformación específica de Plex |
| Plex | Fuente ERP |

La documentación de las consultas exactas de BOM, inventario y demanda debe mantenerse junto al Plex proxy cuando su código se encuentre bajo control del proyecto.

## Pruebas

El árbol de Warehouse revisado no contiene un directorio de pruebas funcionales.

Las prioridades son:

1. cache key por operación y parámetros;
2. timeouts y errores de proxy;
3. validación de `need`;
4. contrato del BOM;
5. contrato CTB, incluyendo revisión activa;
6. Demand por status y customer;
7. autorización de acceso al módulo.
