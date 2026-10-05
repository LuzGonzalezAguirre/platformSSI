# Módulos SSI y componentes comunes

## Estado general

El repositorio contiene tres paquetes backend relacionados con SSI:

- `apps.ssi_common`;
- `apps.ssi_attendance`;
- `apps.ssi_chairs`.

También contiene frontend independiente para:

- attendance;
- chair control;
- safe launch.

Sin embargo, estos componentes no tienen el mismo estado operativo.

`ssi_common` sí se importa activamente desde Producción, Calidad y Mantenimiento y su URL de filtros está incluida bajo `/api/v1/common/`.

`ssi_attendance` y `ssi_chairs` no están registrados en `INSTALLED_APPS` ni incluidos en `config/urls.py` en el estado revisado.

Sus dashboards React tampoco aparecen montados en `App.tsx`.

Por lo tanto, Attendance y Chair Control de este árbol deben considerarse implementaciones paralelas/no conectadas, no endpoints activos de platformSSI.

La funcionalidad activa equivalente de asistencia y Ley Silla utiliza rutas del módulo `production`.

## ssi_common

### Propósito

`ssi_common` contiene lógica compartida que evita duplicar reglas entre módulos.

En el código activo se utiliza para:

- clasificación de Business Unit;
- clasificación por cliente;
- filtros comunes;
- resolución de turno;
- división segura de rangos Plex;
- referencias de Action Tracker;
- acceso al Q-Wall proxy en componentes SSI.

## Clasificación por Business Unit

`bu_classification.py` define tres criterios diferentes.

### Clasificación amplia

`resolve_bu_from_workcenter`.

Se utiliza cuando interesa clasificar todo el piso, por ejemplo COGP por costo.

Heater Module se divide entre Volvo y Cummins según workcenter.

TULC se clasifica directamente.

Los grupos no cubiertos devuelven `None`.

### Clasificación de producción

`resolve_bu_for_production`.

Utiliza workcenters terminales.

Para valores no clasificados retorna `SPEED` como fallback de compatibilidad.

Los consumidores que necesiten descartar no terminales no deben utilizar esta función.

### Clasificación estricta de finished goods

`resolve_bu_for_finished_goods`.

Devuelve una BU solamente para workcenters considerados válidos para producto terminado o para el contrato de Scrap Rate.

Si no existe coincidencia devuelve `None`.

Esta función se usa cuando numerador y denominador deben representar la misma unidad física.

### Speed

El mapa contiene contratos explícitos para Eaton y John Deere.

Entre los workcenters incluidos están:

- `Speed - Final Test` para Eaton;
- `Speed - Final Test 3` para John Deere.

El mismo archivo contiene workcenters adicionales utilizados por Scrap Rate de Eaton.

Modificar estos mapas cambia el significado histórico de métricas basadas en piezas y requiere invalidar o versionar cachés relacionados.

## Cliente frente a Business Unit

El código distingue cliente de Business Unit.

Volvo, Cummins y TULC tienen una correspondencia directa en la lógica actual.

Speed se resuelve como cliente John Deere para determinados consumidores.

Existe un comentario pendiente de negocio para el grupo `Speed - WSS/JET/BA`; mientras no se confirme, ese grupo queda sin clasificar.

Los consumidores deben mostrar los workcenters no clasificados en lugar de ocultarlos.

## RBAC por Business Unit

`get_allowed_bu_for_user` es el punto único definido para limitar visibilidad por BU.

Actualmente devuelve todas las BUs para todos los usuarios.

El propio archivo indica que la restricción real por BU está pendiente.

Los módulos que llaman esta función están preparados para incorporar el control central posteriormente, pero hoy no existe segmentación efectiva de datos por BU.

## Rangos Plex

`plex_ranges.py` centraliza la división de rangos de fechas para consultas al ERP.

Los módulos deben utilizar este helper en lugar de implementar límites de Plex de forma independiente.

Existe cobertura en `ssi_common/tests/test_plex_ranges.py`.

## Action Tracker

`action_tracker_actions.py` lee acciones abiertas desde CCS a través del Q-Wall proxy.

Fuentes válidas:

- `scrap`;
- `maintenance`.

Endpoint:

`/action-tracker/open-actions`.

Si el proxy configurado con `host.docker.internal` falla, intenta `127.0.0.1:8002`.

Los errores de integración no rompen el dashboard: se registran y se devuelve una lista vacía.

`dedupe_actions` elimina duplicados por item ID preservando el primer enlace recibido.

## Cliente común Q-Wall proxy

`ssi_common.db` expone únicamente:

- `proxy_post`;
- `proxy_get`.

Ambos usan Q-Wall proxy con timeout de 30 segundos.

El archivo declara explícitamente que todo SQL de Chairs y Attendance debe ejecutarse dentro del proxy Windows con Integrated Security.

No existe actualmente una función `execute_query` en este módulo.

## ssi_attendance

### Estado

Existe código backend y frontend, además de scripts SQL, pero no está conectado al proyecto Django principal.

El frontend espera el prefijo:

`/api/v1/ssi/attendance`.

Ese prefijo no existe en `config/urls.py`.

### API diseñada

El paquete define rutas para:

- check-in;
- check-out;
- overtime;
- today status;
- KPIs;
- attendance records;
- employees;
- departments;
- PDF;
- Excel.

### Integración diseñada

`AttendanceService` delega records, KPIs y employees al Q-Wall proxy.

`CheckInService` delega check-in, check-out, overtime y today status al mismo proxy.

Los scripts SQL incluidos en el paquete definen infraestructura externa, no migraciones Django.

### Inconsistencias actuales

`DepartmentListView` llama `AttendanceService.get_departments()`, pero ese método no existe en `attendance_service.py`.

`CheckInView` y `CheckOutView` llaman `CheckInService.get_employee_by_barcode()`, pero ese método no existe en `checkin_service.py`.

`report_service.py` intenta importar `execute_query` desde `apps.ssi_common.db`, pero `ssi_common.db` no define esa función.

Por lo tanto, aun si las URLs se registraran, el paquete requiere correcciones antes de considerarse operativo.

### Frontend

`AttendanceDashboard` implementa:

- check-in/check-out;
- dashboard;
- overtime;
- filtros;
- PDF;
- Excel.

El cliente usa Axios directamente en lugar del `apiClient` compartido de platformSSI.

Si estos endpoints se montan bajo la autenticación JWT actual, debe verificarse que el cliente adjunte correctamente el Bearer token.

## ssi_chairs

### Estado

El paquete tampoco está registrado en Django ni montado en el router principal del frontend.

### API diseñada

Rutas:

- kpis;
- breaks;
- daily chart;
- shift chart;
- PDF.

Los services delegan los datos al Q-Wall proxy.

### Frontend

`ChairDashboard` utiliza TanStack Query y muestra:

- KPIs;
- filtros;
- gráfica diaria;
- distribución por turno;
- tabla de breaks;
- descarga PDF.

El cliente también usa Axios directamente en lugar del cliente HTTP compartido.

### Relación con Ley Silla activa

platformSSI ya tiene una ruta activa:

`/production/leysilla`.

El módulo Producción delega KPIs, breaks y charts a endpoints del Q-Wall proxy.

Por ello, `ssi_chairs` representa una implementación paralela que debe consolidarse o retirarse para evitar dos contratos de frontend distintos para la misma fuente.

## Safe Launch

`SafeLaunchTutorial.tsx` es un componente de tutorial de seis pasos.

Describe un flujo de:

1. inicio;
2. credencial;
3. unidad de negocio;
4. modelo;
5. inspección;
6. work order.

El componente requiere un arreglo de imágenes y opcionalmente un callback `onFinish`.

No está importado ni registrado en `App.tsx`.

Por lo tanto, actualmente es un componente aislado, no una ruta activa de platformSSI.

## Recomendación de consolidación

Antes de activar los paquetes SSI paralelos debe tomarse una decisión explícita:

1. conservar los flujos activos bajo `production` y eliminar o archivar el código SSI duplicado; o
2. convertir `ssi_attendance` y `ssi_chairs` en los módulos canónicos, registrarlos formalmente y migrar las rutas activas.

Mantener ambos contratos en paralelo aumenta el riesgo de que una corrección se aplique solo en una de las implementaciones.

Esta documentación no toma la decisión funcional; registra el estado AS-IS.
