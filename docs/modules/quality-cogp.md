# Calidad: COGP y Scrap

## Propósito

El submódulo COGP calcula tendencias de scrap por costo y piezas, clasifica resultados por business unit y puede convertir offenders semanales en registros de Action Tracker mediante la integración de CCS.

El backend se encuentra en `apps/backend/apps/quality/cogp`.

El frontend se encuentra en `apps/frontend/src/modules/quality/cogp` y utiliza `services/cogp.service.ts`.

## Configuración

`CogpSettings` es un singleton de PostgreSQL.

Targets predeterminados:

| Métrica | Target |
| --- | ---: |
| Cost | 2.00% |
| Pieces | 10.00% |

Los valores pueden modificarse mediante `/quality/cogp/settings/`.

Lectura del reporte: `quality_engineer`, `plant_manager` y `admin`.

Edición de targets: `quality_engineer`, `admin` o superusuario.

## Endpoints

| Endpoint | Uso |
| --- | --- |
| `settings/` | Targets |
| `summary/` | Resumen por rango |
| `weekly-trend/` | Tendencia semanal |
| `mapping/` | Catálogo parte a BU |
| `pareto/` | Pareto de scrap |
| `scrap-rate/` | Scrap rate semanal por piezas |
| `scrap-integration/test/` | Prueba controlada de staging |
| `scrap-integration/current-offenders/` | Generación manual de offenders |

## Fuentes Plex

Los servicios acceden a Plex mediante `QualityPlexClient` y el Plex proxy.

Las consultas relevantes incluyen:

- scrap por rango;
- producción y costo extendido por rango;
- producción por cantidad;
- cost model.

Los rangos se dividen en ventanas para respetar límites del ERP.

Los procesos de backfill ejecutan días secuencialmente para evitar consultas masivas paralelas.

## Clasificación de business unit

La clasificación reutiliza reglas compartidas de platformSSI y un tratamiento especial para el grupo Speed.

Para scrap de Speed, el workcenter físico tiene prioridad porque existen partes de empaque reutilizadas entre clientes.

Terminales vigentes para finished good:

| Cliente | Workcenter terminal |
| --- | --- |
| Eaton | `Speed - Final Test` |
| John Deere | `Speed - Final Test 3` |

La clasificación de producción utiliza esos terminales exclusivos.

La lógica está concentrada en `speed_customer_classification.py` y no debe duplicarse en frontend.

## COGP por costo

El porcentaje de costo se calcula con scrap cost contra production/extended cost según el servicio correspondiente.

Los datos diarios usados también por Ops Report se centralizan en `CogpDailyBuService`.

Esta reutilización evita que Producción y Calidad calculen el mismo indicador con reglas de clasificación distintas.

## Scrap rate por piezas

`ScrapRateService` calcula tendencia semanal por piezas.

La implementación del frontend expone actualmente VOLVO, CUMMINS y TULC para esta vista.

Si no se envía selección de BU, el backend suma las BUs rastreadas por ese servicio.

Para la tasa de piezas se contabiliza únicamente scrap de workcenters terminales que tienen una contraparte válida en el denominador de producción.

El scrap de molding o subensambles descartado de esta tasa no desaparece del sistema: continúa reflejado en COGP por costo.

Si Plex devuelve filas pero ninguna cantidad puede clasificarse, el servicio lanza error en lugar de guardar ceros falsos en caché.

## Caché de scrap rate

El servicio diferencia semanas cerradas y periodo actual para reducir consultas al ERP.

Existe una tarea `warm_scrap_rate_cache` que precalienta por defecto 52 semanas.

La intención declarada es evitar que el primer usuario del día pague el costo de una consulta histórica extensa contra Plex.

## Offenders semanales

`stage_weekly_cogp_offenders` obtiene la última semana laboral completa.

La tarea está configurada en Celery Beat para los sábados a las 07:00.

`stage_current_offenders`:

1. resuelve la semana laboral completa;
2. obtiene targets vigentes;
3. consulta scrap, costo de producción y cantidades;
4. clasifica cada fila por BU;
5. calcula totales por BU;
6. determina qué BUs superan target de costo o piezas;
7. ordena contribuciones de scrap;
8. selecciona las contribuciones necesarias para representar el exceso sobre target;
9. envía cada offender seleccionado a CCS mediante Q-Wall proxy.

## Fórmulas de prueba

La prueba manual usa:

`cost_rate = scrap_cost / production_cost * 100`

y:

`piece_rate = scrap_qty / (scrap_qty + produced_qty) * 100`

La prueba se rechaza si no supera por lo menos uno de los dos targets.

## Idempotencia

Cada offender genera un `source_key` SHA-256 a partir de:

- week start;
- week end;
- business unit;
- workcenter;
- part number;
- reason.

En modo test también incorpora `test_run_id`.

El source key se envía al endpoint `/scrap-offenders/stage` del Q-Wall proxy para permitir deduplicación en el destino.

## Integración con CCS

Django no escribe directamente SQL Server.

`scrap_action_service.stage` utiliza Q-Wall proxy.

Si la URL configurada usa `host.docker.internal` y la conexión falla, el servicio intenta `127.0.0.1:8002` como fallback del host Windows.

## Tareas Celery

| Tarea | Uso |
| --- | --- |
| `sync_cogp_daily` | Sincronizar scrap/producción de un día y recalcular resumen |
| `backfill_cogp_range` | Backfill secuencial de un rango |
| `warm_scrap_rate_cache` | Precalentar scrap rate |
| `stage_weekly_cogp_offenders` | Enviar offenders de la semana laboral |

`sync_cogp_daily` usa el día anterior cuando no recibe fecha y tiene reintentos.

Los modelos se actualizan mediante claves únicas para que la tarea pueda reejecutarse sin duplicar los registros de negocio correspondientes.

## Observaciones de autorización

Las vistas principales de COGP verifican roles explícitos además de autenticación.

Sin embargo, no todas aplican el fallback de superusuario de la misma forma. Settings y endpoints de staging sí contemplan superusuario de forma explícita, mientras algunas vistas de reporte se basan únicamente en la intersección de roles.

La autorización debería normalizarse en una política común.
