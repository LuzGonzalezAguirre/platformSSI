# Operational Panel

## Propósito

Operational Panel es un dashboard transversal que consolida indicadores de Producción, Mantenimiento, Work Requests y Calidad en una sola vista operativa.

Su responsabilidad es composición y presentación. No posee modelos Django, endpoints propios, tablas propias ni una capa backend exclusiva.

La ruta activa es:

`/operational-panel`

El componente principal es:

`apps/frontend/src/modules/operational-panel/OperationalPanelPage.tsx`

## Estado

Estado actual: implementado.

El módulo está registrado en `App.tsx`, aparece como sección propia en el Sidebar y consume servicios activos de otros dominios.

Debe entenderse como una vista agregada. La fuente de verdad de cada métrica continúa perteneciendo al módulo que la produce.

## Dependencias funcionales

Operational Panel reutiliza:

| Dominio | Cliente frontend | Datos utilizados |
| --- | --- | --- |
| Producción | `OpsReportService` | Daily Summary y OEE guardado |
| Mantenimiento | `MaintenanceService` | KPIs y OEE live |
| Mantenimiento | `useDashboardTargets` | Targets de MTTR y MTBF |
| Work Requests | `WorkRequestsService` | Dashboard de solicitudes |
| Calidad | `QualityService` | Scrap detail y yield |

No existe un endpoint agregado del tipo `/operational-panel/`.

## Flujo de carga

La función `load()` ejecuta seis solicitudes en paralelo mediante `Promise.all`:

1. `OpsReportService.getDailySummary(prodDate)`;
2. `OpsReportService.getOEE(prodDate)`;
3. `MaintenanceService.getKPIs(dateStart, dateEnd)`;
4. `MaintenanceService.getOEELive(dateStart, dateEnd)`;
5. `WorkRequestsService.getDashboard(dateStart, dateEnd)`;
6. `QualityService.getScrapDetail(...)`.

Cada promesa captura individualmente sus errores y devuelve `null`.

Como resultado, una fuente caída no impide necesariamente que se rendericen los demás bloques.

El estado agregado interno contiene:

- `prod`;
- `oee`;
- `maint`;
- `oeeLive`;
- `wr`;
- `scrap`.

## Endpoints consumidos

El módulo termina utilizando los siguientes contratos HTTP existentes:

| Endpoint | Propósito |
| --- | --- |
| `GET /api/v1/production/ops/daily-summary/` | Producción diaria por BU |
| `GET /api/v1/production/ops/oee/` | OEE persistido del día |
| `GET /api/v1/maintenance/overview/kpis/` | MTTR, MTBF, fallas y horas |
| `GET /api/v1/maintenance/overview/oee-live/` | OEE calculado para el periodo |
| `GET /api/v1/maintenance/work-requests/dashboard/` | KPIs y agrupaciones de Work Requests |
| `GET /api/v1/quality/scrap-detail/` | Yield, scrap y Pareto de razones |
| `GET /api/v1/maintenance/overview/targets/` | Targets configurados de Maintenance |

La documentación de cálculo y ownership de estos endpoints pertenece a los documentos de Producción, Mantenimiento y Calidad.

## Manejo de fechas

El usuario puede seleccionar dos modos:

- día;
- rango.

Valores iniciales:

- día: fecha actual;
- inicio de rango: primer día del mes actual;
- fin de rango: fecha actual.

Las fechas futuras quedan bloqueadas desde los inputs HTML.

### Día

En modo día:

`prodDate = singleDate`

`dateStart = singleDate`

`dateEnd = singleDate`

Todas las fuentes se consultan para el mismo día.

### Rango

En modo rango:

`prodDate = rangeEnd`

`dateStart = rangeStart`

`dateEnd = rangeEnd`

Producción diaria utiliza únicamente el último día del rango.

El propio frontend informa esta condición y dirige al usuario a Ops Daily Report para consultar acumulados.

Mantenimiento, Work Requests y Scrap sí reciben el rango completo.

## Auto-refresh

Cuando la selección termina en la fecha actual, se crea un intervalo de actualización cada cinco minutos.

Aplica tanto a:

- modo día cuando `singleDate` es hoy;
- modo rango cuando `rangeEnd` es hoy.

Para periodos históricos no se crea el intervalo.

Además existe un botón de refresh manual.

## Indicadores principales

La primera fila contiene seis KPIs:

| KPI | Fuente | Regla visual actual |
| --- | --- | --- |
| Yield FPY | `scrap.summary.yield_pct` | Meta hardcodeada 98% |
| OEE | OEE diario o fallback live | Meta hardcodeada 65% |
| MTTR | Maintenance KPIs | Target configurable |
| MTBF | Maintenance KPIs | Target configurable |
| Backlog WR | Work Requests | Verde 0, amarillo hasta 5, rojo mayor a 5 |
| Scrap qty | Scrap Detail | Verde 0, amarillo menor a 10, rojo desde 10 |

La función local `semaphore()` aplica:

Para métricas donde un valor mayor es mejor:

- verde si valor >= target;
- amarillo si valor >= 90% del target;
- rojo en otro caso.

Para métricas donde un valor menor es mejor:

- verde si valor <= target;
- amarillo si valor <= 150% del target;
- rojo en otro caso.

MTTR usa comparación menor-es-mejor.

MTBF usa comparación mayor-es-mejor.

## Targets configurables

Operational Panel obtiene targets de Maintenance mediante `useDashboardTargets`.

Las keys utilizadas son:

- `mttr`;
- `mtbf`.

Fallbacks frontend cuando no existe configuración:

- MTTR: 2 horas;
- MTBF: 40 horas.

Los targets de Yield FPY y OEE no utilizan este mecanismo en Operational Panel.

Actualmente permanecen hardcodeados en 98% y 65%, respectivamente.

## Producción

La tarjeta de Producción muestra únicamente tres claves del `DailySummary`:

- `volvo`;
- `cummins`;
- `tulc`.

Para cada una presenta:

- cantidad producida;
- target;
- porcentaje de avance contra target;
- yield.

La barra de avance limita el ancho visual a 100%.

El color de avance se calcula usando 90% como target visual.

La sección también presenta un mini gráfico de yield para las mismas tres BUs.

Aunque `DailySummary` permite claves dinámicas de BU, el componente no itera el conjunto recibido: las tres BUs anteriores están seleccionadas explícitamente en código.

## OEE y Mantenimiento

La tarjeta muestra:

- OEE;
- Availability;
- Performance;
- Quality;
- MTTR;
- MTBF;
- total de fallas.

### Resolución de OEE

La prioridad implementada es:

1. usar `OpsReportService.getOEE(prodDate)` cuando devuelve registro;
2. si no existe, usar `MaintenanceService.getOEELive(dateStart, dateEnd)`.

Esto significa que en modo rango puede mostrarse primero el OEE persistido de `rangeEnd`, aunque el subtítulo de la tarjeta indique el rango completo.

El OEE live del rango funciona como fallback, no como primera fuente en modo rango.

## Calidad

La tarjeta de Calidad utiliza `QualityService.getScrapDetail` con:

`use_shift=false`.

Presenta:

- Yield FPY;
- scrap total en piezas;
- top cuatro razones de scrap por cantidad.

Las razones se toman de `by_reason` y no se reordenan en Operational Panel; se confía en el orden entregado por el backend.

El target visual de Yield es 98% fijo en este componente.

## Work Requests

La tarjeta consume `WRDashboard`.

Presenta:

- hasta cuatro estados de `by_status`;
- porcentaje completado;
- total de WR;
- backlog;
- horas reales de mantenimiento;
- top failure;
- top cuatro fallas por horas.

El color de estados se infiere a partir del texto del label:

- contiene `complet`: verde;
- contiene `progress` o `curso`: azul;
- contiene `pend`: amarillo;
- otro valor: gris.

Esta lógica depende del contenido textual del status y no de un código normalizado.

## Navegación desde tarjetas

Cada bloque incluye `Ver más` hacia la pantalla fuente:

| Tarjeta | Destino |
| --- | --- |
| Producción | `/production/ops-daily-report` |
| OEE & Maintenance | `/maintenance/overview` |
| Calidad | `/quality/dashboard` |
| Work Requests | `/maintenance/work-requests` |

Operational Panel no reemplaza las vistas de detalle.

## Internacionalización

El idioma se deriva de `i18n.language`.

Si comienza con `es`, el componente usa textos españoles; de lo contrario utiliza inglés.

Una parte del texto se selecciona manualmente con condicionales locales en lugar de utilizar keys de traducción para cada string.

## Autorización y navegación

`App.tsx` protege la ruta únicamente mediante `PrivateRoute`, que valida autenticación.

El Sidebar declara Operational Panel para todos los roles legacy.

`useSidebar` mapea la sección:

`operational-panel -> production`

Por ello la visibilidad del menú exige permiso `production.view`.

Sin embargo, navegar manualmente a `/operational-panel` no ejecuta un guard específico de permiso.

La autorización efectiva de los datos depende de los endpoints backend llamados por cada servicio.

## Manejo de errores

Cada fuente se degrada a `null` de forma independiente.

El componente representa datos faltantes principalmente con:

`—`

No existe un banner que indique qué fuente falló.

`lastUpdate` se actualiza después de terminar `Promise.all`, incluso si una o varias fuentes devolvieron `null` por error.

Por tanto, "Actualizado" significa que terminó el intento de carga, no que todas las fuentes respondieron correctamente.

## Estado y caché frontend

Operational Panel utiliza:

- `useState`;
- `useEffect`;
- `useCallback`.

No usa TanStack Query para las seis llamadas principales.

Cada cambio de fechas ejecuta una nueva carga.

No existe un caché de datos propio del módulo.

Los mecanismos de caché que puedan existir en backend o servicios fuente son responsabilidad de esas capas.

## Datos propios

Operational Panel no crea ni persiste datos.

No posee:

- modelos Django;
- migraciones;
- tablas;
- serializers;
- tasks;
- jobs Celery;
- archivos de exportación propios.

La única configuración que consume directamente es la de targets de Maintenance.

## Limitaciones conocidas

### Semántica de rango de OEE

En rango, el OEE persistido del último día tiene prioridad sobre el OEE live del rango.

La UI etiqueta la tarjeta con el periodo completo, por lo que la semántica puede resultar ambigua.

Debe decidirse si la tarjeta representa:

- OEE del último día;
- OEE agregado del rango.

Después debe utilizarse una única regla.

### BUs de Producción hardcodeadas

La vista únicamente presenta Volvo, Cummins y TULC.

Si el backend devuelve otras BUs, no aparecen automáticamente.

### Targets mixtos

MTTR y MTBF son configurables.

Yield FPY, OEE, progreso de producción, completion de WR, backlog y scrap quantity utilizan umbrales locales hardcodeados.

Esto genera dos fuentes de configuración visual.

### Backlog versus overdue

El valor mostrado proviene de `wr.kpis.backlog`, definido como solicitudes pendientes.

El subtítulo español del KPI dice "Work Requests vencidas".

Backlog y overdue no son equivalentes.

El contrato de `WRKpis` dispone de backlog, mientras que la descripción visual puede inducir a interpretar el valor como vencidos.

### Estados de WR basados en texto

La semaforización usa coincidencias parciales sobre el label del estado.

Cambios de idioma o nomenclatura pueden alterar el color sin cambiar el significado funcional.

### Errores silenciosos

La degradación parcial mejora disponibilidad visual, pero no distingue entre:

- dato realmente vacío;
- error HTTP;
- timeout;
- contrato incompatible.

Una representación de estado por fuente permitiría evitar falsos "sin datos".

### Layout fijo de escritorio

Las filas principales usan grids explícitos de seis y tres columnas.

El componente no define en este archivo breakpoints responsivos para convertir esas filas en una composición móvil.

## Pruebas

No existe una suite específica junto al módulo `operational-panel`.

Escenarios prioritarios:

1. carga correcta de las seis fuentes;
2. una fuente fallida sin bloquear las otras;
3. modo día;
4. modo rango;
5. auto-refresh únicamente cuando el periodo termina hoy;
6. fallback entre OEE persistido y OEE live;
7. targets configurables de MTTR/MTBF;
8. ausencia de targets y uso de fallback;
9. permiso de navegación;
10. BUs faltantes;
11. estados de WR no reconocidos;
12. responsive layout.

## Regla de mantenimiento

Operational Panel debe mantenerse como capa de composición.

Cuando cambie un contrato de Production, Maintenance, Work Requests o Quality que sea consumido aquí, debe verificarse este módulo.

No debe copiarse dentro de Operational Panel la lógica de cálculo de métricas que ya pertenece a los services o endpoints de dominio.
