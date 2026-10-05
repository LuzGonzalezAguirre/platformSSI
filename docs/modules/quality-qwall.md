# Calidad: Q-Wall

## Propósito

La integración Q-Wall permite analizar inspecciones de calidad almacenadas en SQL Server CCS sin conectar Django directamente a SQL Server.

Django utiliza `QWALL_PROXY_URL` y `QWALL_PROXY_TOKEN` para comunicarse con `apps/qwall-proxy`.

## Flujo de datos

`React -> Django REST -> QWallRepository / settings views -> qwall-proxy -> SQL Server CCS`

PostgreSQL se utiliza únicamente para información que pertenece a platformSSI, como traducciones, imágenes de catálogo y el target global de pass rate.

## Datos de inspección

`QWallRepository.get_inspections` llama `POST /inspections` al proxy.

La consulta acepta rango de fechas y uno o varios BU IDs.

El resultado crudo se conserva en Redis durante 300 segundos.

También se cachean durante 300 segundos:

- piece flags;
- conteo de flags;
- business units;
- part numbers;
- fallas por inspection point.

Los timeouts de lectura de reportes son de hasta 120 segundos.

## Filtro de órdenes de prueba

`QWallService._is_test_wo` considera una work order de prueba cuando:

- es nula;
- está vacía;
- vale cero;
- contiene únicamente ceros;
- tiene prefijo P seguido únicamente por ceros.

La función `_filter_test` tiene una semántica importante:

- `include_test=false`: devuelve únicamente órdenes no consideradas prueba;
- `include_test=true`: devuelve únicamente órdenes consideradas prueba.

Por lo tanto, `include_test` funciona actualmente como selector entre producción y prueba, no como "incluir pruebas además de producción".

## Reporte principal

`QWallService.get_report` construye el reporte a partir de inspecciones y piece flags.

El payload agregado contiene métricas como:

- total de inspecciones;
- PASS;
- FAIL;
- pass rate;
- duración promedio;
- inspectores;
- part numbers;
- agrupación por inspector;
- agrupación por parte;
- modos de falla;
- piece flags;
- changeovers;
- runs por part number.

El resultado agregado se cachea 300 segundos.

La clave de caché incorpora rango, modo test, BUs y locale.

## Changeovers

Los changeovers se calculan en Python.

La razón indicada en el código es evitar depender de funciones de ventana de SQL no confiables en el entorno DataDirect/OpenAccess.

La secuencia se separa primero por BU y después se ordena cronológicamente.

Un cambio de part number dentro de la misma BU incrementa el número de changeovers.

El primer registro visible dentro de un rango se considera inicio de run aunque el run real haya comenzado antes del rango.

## Resúmenes

El módulo expone:

| Endpoint | Resultado |
| --- | --- |
| `qwall/` | Reporte principal |
| `qwall/trend/` | Tendencia |
| `qwall/pareto/` | Pareto |
| `qwall/fail-by-point/` | Distribución de fallas por punto |
| `qwall/bu-summary/` | Resumen por BU |
| `qwall/part-number-summary/` | Resumen por número de parte |
| `qwall/part-numbers/` | Catálogo de partes |

El resumen de part number requiere una business unit y devuelve además la parte con pass rate más bajo.

En caso de empate, el servicio favorece la parte con mayor número de inspecciones.

## Fail modes

El Pareto utiliza código y descripción del modo de falla.

`FailModeTranslation` mantiene traducciones locales en PostgreSQL.

La relación con CCS es por código lógico, no por foreign key.

`FailModeTranslationService` permite obtener el mapa de traducciones, identificar faltantes y realizar upsert.

## Pass rate target

`QWallSettings` es un singleton de PostgreSQL con `pk=1`.

El valor predeterminado de `pass_rate_target` es 95%.

La configuración no mantiene historial propio.

La escritura registra `updated_by` y `updated_at`.

## Q-Wall Settings

El grupo `/quality/qwall/settings/` administra catálogos y configuración a través del proxy.

Los endpoints cubren:

- business units;
- roles Q-Wall;
- usuarios;
- part numbers;
- inspection points;
- fail modes;
- asignación de fail modes a inspection points;
- system config;
- traducciones;
- pass rate target;
- lot sampling.

La mayoría de las operaciones sobre catálogos se reenvían al Q-Wall proxy.

## Autorización de settings

`qwall_settings_views.py` permite acceso administrativo únicamente a usuarios con rol:

- `admin`;
- `quality_engineer`.

La verificación usa los roles asociados al usuario en PostgreSQL.

El pass rate target puede leerse por un usuario autenticado, pero su escritura exige ese acceso administrativo.

## Lot sampling

La implementación vigente de lot sampling persiste la configuración y la matriz en CCS.

Los endpoints Django son una fachada autenticada hacia el proxy:

- `lot-sampling/matrix/`;
- `lot-sampling/configurations/`;
- `lot-sampling/{bu_id}/`.

Las migraciones muestran una evolución explícita:

- la migración 0008 introdujo estructuras de lot sampling en PostgreSQL;
- la migración 0009 las eliminó.

La fuente vigente es CCS, no PostgreSQL.

Existe documentación funcional adicional en `docs/qwall-lot-sampling.md`.

## Catálogo visual

`FailureCatalogService` agrega imágenes mantenidas en PostgreSQL a la estructura de fail modes obtenida de CCS.

El servicio puede trabajar con locale distinto de español y reemplazar la descripción original por la traducción cuando existe.

## Exportación

El frontend permite descargar el reporte Q-Wall como Excel mediante el mismo endpoint `/quality/qwall/` con `export=xlsx`.

Esta descarga se implementa con `fetch` directo y toma el access token del almacenamiento local.

## Deuda técnica

`QWallRepository` define `get_part_numbers` dos veces. La última definición reemplaza la primera en tiempo de importación.

El nombre `include_test` no refleja con precisión su semántica actual, ya que `true` selecciona exclusivamente datos de prueba.

Estas condiciones deben corregirse en un cambio funcional separado.
