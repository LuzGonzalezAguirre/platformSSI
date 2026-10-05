# Módulo de Producción

## Alcance

El dominio de Producción combina información propia almacenada en PostgreSQL con información obtenida desde Plex y SQL Server mediante proxies.

El backend principal se encuentra en `apps/backend/apps/production`.

El frontend se encuentra en `apps/frontend/src/modules/production`.

Las funciones visibles actualmente incluyen Ops Daily Report, targets, WIP, OEE, seguridad, asistencia, productividad, integración de asistencia CCS y funciones relacionadas con Ley Silla.

## Frontend

Las rutas registradas en `App.tsx` son:

| Ruta | Página |
| --- | --- |
| `/production/ops-daily-report` | OpsReportPage |
| `/production/targets` | TargetsPage |
| `/production/safety` | SafetyPage |
| `/production/assistance` | AssistancePage |
| `/production/leysilla` | LeysillaPage |

El menú permite estas vistas a los roles definidos como `ALL_ROLES` en la configuración actual del frontend.

## Modelo de datos propio

### BusinessUnit

Tabla `production_business_unit`.

Define código, nombre y estado activo de las unidades de negocio utilizadas por targets y reportes.

### WeeklyTarget

Tabla `production_weekly_target`.

Mantiene una meta general semanal y valores opcionales por día.

La combinación de business unit y `week_start` es única.

Cuando un valor diario es nulo, `get_day_target` utiliza `general_target`.

### WeeklyWIP

Tabla `production_weekly_wip`.

Mantiene actual y goal generales y valores opcionales por día.

Cuando un valor diario es nulo, se utiliza el valor general correspondiente.

### OEERecord

Tabla `production_oee_record`.

Existe un único registro por fecha con availability, performance, quality y OEE.

El modelo conserva el usuario y fecha de última actualización.

### PlantEmployee

Tabla `production_plant_employee`.

Representa personal de planta utilizado por los flujos locales de asistencia.

Contiene nombre, departamento, turno, barcode y relación opcional con `identity.User`.

La eliminación operativa se implementa como desactivación mediante `is_active`.

### AttendanceRecord

Tabla `production_attendance_record`.

Registra asistencia local por empleado y fecha.

La combinación empleado y fecha es única.

Los estados definidos son present, absent, vacation, leave y sick.

### CcsAttendanceRecord

Tabla `production_ccs_attendance`.

Mantiene el overlay de asistencia editado desde platformSSI para empleados identificados por un ID proveniente del flujo CCS.

La combinación `ccs_employee_id` y fecha es única.

### EarnedHoursRecord

Tabla `production_earned_hours_record`.

Existe un registro por fecha con earned hours, notas, usuario y timestamp de registro.

## Política de asistencia

`AttendancePolicy` concentra la semántica de estados.

`absent` y `vacation` fuerzan cero horas.

`vacation` se considera ausencia planeada y se excluye de la base utilizada para calcular el porcentaje de asistencia.

`absent` se considera ausencia no planeada.

`present` representa presencia física.

Para `shift=full`, el turno A utiliza 12 horas y el turno B 11 horas cuando se utiliza la firma efectiva de `resolve_hours`.

El porcentaje de asistencia se calcula como presentes dividido entre headcount total menos vacaciones.

## Productividad

`ProductivityService.get_daily_productivity` combina asistencia registrada y earned hours.

No calcula productividad si todavía no existe asistencia guardada, si las horas pagadas son cero o si no existe registro de earned hours.

Cuando existen ambos componentes:

`productivity_pct = earned_hours / paid_hours * 100`

El resultado se redondea a una decimal.

## Targets, WIP y OEE

### API

| Endpoint | Métodos | Uso |
| --- | --- | --- |
| `/api/v1/production/business-units/` | GET | Catálogo de BUs |
| `/api/v1/production/targets/weekly/` | GET, POST | Targets semanales |
| `/api/v1/production/wip/weekly/` | GET, POST | WIP semanal |
| `/api/v1/production/ops/oee/` | GET, POST | OEE por fecha |

Targets y WIP reciben una fecha de semana y código de BU.

Al guardar, el servicio expande el valor general hacia los días que no tengan valor específico.

## Ops Daily Report

El reporte operacional combina múltiples fuentes.

### Producción

`OpsReportService.get_daily_production` consulta el endpoint `/daily-production` del Plex proxy.

La respuesta se conserva en caché durante 600 segundos.

### Earned labor hours

`get_earned_labor_hours` consulta `/earned-labor-hours` del Plex proxy y mantiene caché de 600 segundos.

### Yield

`get_yield_by_client` consulta `/yield-by-client` del Plex proxy y mantiene caché de 600 segundos.

### COGP y scrap

El reporte no utiliza el endpoint histórico `/scrap-cogp`.

La fuente actual es `CogpDailyBuService`, compartida con el módulo de Calidad, para mantener una sola clasificación por BU y una sola fuente para numerador y denominador de COGP.

El porcentaje utilizado es:

`scrap_cost / extended_cost * 100`

cuando extended cost es mayor que cero.

### Producción contra target

El porcentaje utilizado es:

`quantity / target * 100`

cuando el target es mayor que cero.

### Vista temporal

`get_weekly_table` admite los modos `daily`, `weekly` y `monthly`.

En modo daily se trabaja sobre la semana lunes a domingo.

En modo weekly se trabaja sobre las semanas que intersectan el mes solicitado.

En modo monthly se construye un rango por periodos de cuatro meses según la fecha recibida.

Las consultas de rango a Plex se dividen mediante `date_chunks`.

El resultado agregado se mantiene en caché durante 600 segundos.

## API del reporte operacional

| Endpoint | Uso |
| --- | --- |
| `GET /api/v1/production/ops/daily-summary/` | Resumen diario |
| `GET /api/v1/production/ops/weekly-table/` | Tabla temporal por BU y modo |
| `GET /api/v1/production/ops/export/daily/` | Exportación Excel |
| `GET /api/v1/production/ops/export/pdf/` | Exportación PDF |

El frontend descarga ambos formatos como blobs.

El Excel utiliza una plantilla ubicada en `templates/excel/ops_daily_template.xlsx`.

El PDF utiliza `templates/pdf/ops_daily_report.html` y el servicio `ops_pdf_service.py`.

## Seguridad

### Modelo

Seguridad mantiene configuración del contador de días, incidentes y bitácora de movimientos.

`SafetySettings` guarda el ancla manual o la fecha del último incidente.

`SafetyIncident` registra fecha, tipo, severidad, área, descripción, acciones, root cause y estado.

`SafetyCounterEvent` funciona como bitácora de movimientos del contador.

### Tipos que reinician el contador

Actualmente reinician el contador:

| Tipo |
| --- |
| first_aid |
| recordable |
| lost_time |
| covid_positive |

Near miss, property damage y environmental no aparecen en `COUNTER_RESETTING_TYPES`.

### Regla de actualización

Al crear un incidente que reinicia el contador, el servicio actualiza la fecha solamente si el nuevo incidente es posterior a la fecha de incidente ya registrada.

Un incidente retroactivo anterior no mueve el contador hacia atrás.

El ajuste manual y el reset por incidente generan un `SafetyCounterEvent`.

### Planta

El servicio acepta actualmente únicamente `Tijuana`.

### API

| Endpoint | Uso |
| --- | --- |
| `/api/v1/production/safety/settings/` | Leer o ajustar configuración |
| `/api/v1/production/safety/incidents/` | Consultar o crear incidentes |
| `/api/v1/production/safety/incidents/{id}/` | Actualizar incidente |
| `/api/v1/production/safety/counter-history/` | Consultar bitácora |

## Asistencia local

`/api/v1/production/employees/` administra `PlantEmployee`.

`/api/v1/production/attendance/` obtiene o guarda asistencia por fecha.

Cuando no existe registro para un empleado activo, la vista construye un valor de respuesta por defecto para el día solicitado.

`/api/v1/production/earned-hours/` administra el registro de earned hours por fecha.

`/api/v1/production/productivity/daily/` calcula productividad diaria y permite filtro de turno A o B.

## Integración CCS

`ccs_views.py` actúa como capa entre Django y el Q-Wall proxy.

El proxy se obtiene mediante `QWALL_PROXY_URL` y se autentica mediante Bearer token.

El timeout utilizado por estas llamadas es 30 segundos.

### Barcode attendance

| Endpoint Django | Delegación |
| --- | --- |
| `ccs/check-in/` | `/attendance/check-in` |
| `ccs/check-out/` | `/attendance/check-out` |
| `ccs/overtime/` | `/attendance/overtime` |
| `ccs/today-status/` | `/attendance/today-status` |
| `ccs/attendance/records/` | `/attendance/records` |
| `ccs/attendance/kpis/` | `/attendance/kpis` |

La vista de asistencia diaria obtiene empleados desde el proxy y después aplica registros de `CcsAttendanceRecord` almacenados en PostgreSQL para la fecha solicitada.

Por lo tanto, el flujo combina catálogo o estado externo con overrides persistidos por platformSSI.

## Ley Silla

El backend publica endpoints de chair control bajo Producción y los delega al Q-Wall proxy:

| Endpoint Django | Proxy |
| --- | --- |
| `chairs/kpis/` | `/chairs/kpis` |
| `chairs/breaks/` | `/chairs/breaks` |
| `chairs/daily-chart/` | `/chairs/daily-chart` |
| `chairs/turno-chart/` | `/chairs/turno-chart` |

El frontend contiene una vista independiente `LeysillaPage` y componentes dentro de Assistance.

También existe generación de material PDF de capacitación en `generateTrainingPdf.ts`.

## Autorización observada

El módulo no utiliza una política uniforme.

Las vistas de Safety sí emplean clases generadas con `module_permission`.

Targets, WIP, OEE, asistencia, productividad, Ops Report y gran parte de CCS utilizan únicamente `IsAuthenticated`.

En Safety, `SafetySettingsView` asigna `ProductionEdit` a toda la clase, por lo que incluso GET requiere permiso edit.

`SafetyIncidentListCreateView` asigna `ProductionCreate` a toda la clase, por lo que incluso el listado GET requiere permiso create.

Estas diferencias deben revisarse en una etapa funcional de endurecimiento de autorización.

## Deuda técnica observada

`CcsAttendanceDailyView` aparece definido dos veces dentro de `ccs_views.py`. La segunda definición reemplaza a la primera al cargarse el módulo.

`AttendancePolicy.resolve_hours` aparece definido dos veces. La segunda definición es la efectiva y añade parámetros opcionales `shift` y `turno`.

`OpsDailyPDFExportView.get` aparece definido dos veces. La segunda implementación reemplaza a la primera.

Estas duplicaciones no se corrigen en este commit documental, pero deben eliminarse para reducir ambigüedad.

## Pruebas

El archivo `apps/backend/apps/production/tests.py` contiene únicamente la estructura inicial de pruebas y no constituye cobertura funcional significativa del módulo.

Debido a la cantidad de cálculos e integraciones, las áreas prioritarias para pruebas automatizadas son AttendancePolicy, ProductivityService, SafetyService, agregaciones de OpsReportService y autorización por endpoint.
