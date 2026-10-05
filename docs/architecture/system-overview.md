# Arquitectura general

## Alcance

Este documento describe la arquitectura técnica visible en el repositorio platformSSI. Su propósito es explicar la relación entre frontend, backend, procesamiento asíncrono, almacenamiento e integraciones externas.

## Vista lógica

| Componente | Tecnología principal | Responsabilidad |
| --- | --- | --- |
| Frontend | React 18, TypeScript, Vite | Interfaz de usuario, navegación, estado cliente y consumo de APIs |
| Backend | Django, Django REST Framework | API, autenticación, autorización, reglas de negocio y persistencia |
| Base principal | PostgreSQL 16 | Datos administrados por Django |
| Caché y broker | Redis 7 | Caché y transporte de tareas Celery |
| Worker | Celery | Ejecución asíncrona |
| Scheduler | Celery Beat | Programación de tareas periódicas |
| Q-Wall proxy | FastAPI, pyodbc | Acceso mediado a SQL Server para información de Q-Wall |
| Plex proxy | Servicio externo al compose principal | Acceso mediado a Plex mediante ODBC |
| SQL Server CCS | SQL Server | Fuente operacional para Q-Wall y otros datos integrados |

## Flujo de una solicitud web

El usuario accede al frontend servido por Vite en el entorno actual. React administra las rutas de la aplicación y protege las vistas autenticadas mediante el estado almacenado en el cliente.

Las solicitudes de negocio se envían al backend Django bajo el prefijo `/api/v1`.

Django REST Framework aplica autenticación JWT por defecto y requiere un usuario autenticado salvo que una vista defina una excepción explícita.

La lógica del backend puede resolver la solicitud utilizando PostgreSQL, caché, un servicio externo o una combinación de ellos.

Cuando el trabajo no debe ejecutarse dentro del ciclo HTTP, Django delega la ejecución a Celery. Redis participa como infraestructura de tareas y el resultado de Celery se conserva mediante `django-celery-results`.

## Backend

La configuración central registra aplicaciones para identidad, permisos, auditoría, manufactura, mantenimiento, analítica, integraciones, almacén, producción, calidad y notificaciones.

Las rutas globales publicadas actualmente incluyen:

| Prefijo | Aplicación |
| --- | --- |
| `/api/v1/auth/` | identity |
| `/api/v1/permissions/` | permissions |
| `/api/v1/manufacturing/` | manufacturing |
| `/api/v1/maintenance/` | maintenance |
| `/api/v1/analytics/` | analytics |
| `/api/v1/warehouse/` | warehouse |
| `/api/v1/production/` | production |
| `/api/v1/quality/` | quality |
| `/api/v1/audit/` | audit |
| `/api/v1/notifications/` | notifications |
| `/api/v1/common/` | ssi_common |

La ruta de mantenimiento aparece declarada dos veces en `config/urls.py`. Esto se registra como deuda técnica y no se modifica en este cambio documental.

## Autenticación

El backend utiliza Simple JWT. El identificador principal incluido en los tokens es `employee_id`.

La configuración actual establece una duración de 60 minutos para access tokens y siete días para refresh tokens. La rotación de refresh tokens y el blacklist posterior a la rotación están habilitados.

## Frontend

El frontend utiliza React Router para navegación, Zustand para estado de autenticación, Axios para comunicación HTTP y TanStack Query como dependencia disponible para manejo de estado de servidor.

Las áreas visibles en la navegación actual son panel operacional, producción, calidad, mantenimiento, almacén y administración.

También existen rutas de perfil y configuración, además de vistas especializadas que no necesariamente aparecen como elementos independientes del menú.

## Procesamiento asíncrono

Celery se configura mediante `config/celery.py`. El worker utiliza Redis y el backend de resultados está configurado con `django-db`.

Celery Beat utiliza `django_celery_beat.schedulers:DatabaseScheduler`.

En la configuración base actual existen dos tareas programadas los sábados:

| Tarea | Horario configurado |
| --- | --- |
| COGP weekly offenders | 07:00 |
| Maintenance weekly offenders | 07:15 |

La zona horaria del backend está configurada como `America/Monterrey`.

## Integración con Plex

Django no accede directamente al controlador ODBC de Plex desde el contenedor. Utiliza un servicio proxy disponible por defecto en `http://host.docker.internal:8001`.

El backend recibe la URL y secreto de acceso mediante variables de entorno.

Esta separación permite mantener la dependencia ODBC en el host o servicio que tenga conectividad y controladores compatibles.

## Integración con Q-Wall

El backend utiliza un proxy configurado por defecto en `http://host.docker.internal:8002`.

El proxy incluido en `apps/qwall-proxy` está implementado con FastAPI y pyodbc. Abre conexiones hacia SQL Server y publica endpoints protegidos por Bearer token, además de un endpoint de salud.

El proxy contiene consultas para inspecciones, rechazos, catálogos y flujos relacionados con Q-Wall. Su documentación detallada se mantiene separada de la arquitectura general.

## Arranque

`docker-compose.yml` administra PostgreSQL, Redis, backend, worker Celery, Celery Beat y frontend.

Los proxies de Plex y Q-Wall se inician mediante scripts del host ubicados en `startapp`.

El script operativo también recrea servicios de aplicación, valida que el secreto requerido para Plex esté disponible dentro de Celery y aplica migraciones de Django.

## Seguridad y configuración

El repositorio contiene actualmente valores de conexión y secretos definidos directamente en archivos de configuración y scripts. Esta documentación no reproduce esos valores.

La sustitución de secretos versionados por variables de entorno o un mecanismo de secretos administrados debe tratarse como deuda técnica prioritaria. La documentación futura de operación debe describir nombres de variables y responsabilidades, pero nunca valores reales.

## Principios de separación

PostgreSQL es la base controlada por Django.

SQL Server CCS es un sistema externo y se consume mediante integración.

Plex es un sistema externo y se consume mediante proxy.

La interfaz web no debe conectarse directamente a bases de datos ni a drivers ODBC.

Los trabajos periódicos y procesos largos deben mantenerse fuera del ciclo HTTP cuando su naturaleza sea asíncrona.
