# Backend Django

## Propósito

El backend de platformSSI concentra autenticación, autorización, reglas de negocio, persistencia propia, acceso a integraciones y ejecución de procesos asíncronos.

La aplicación utiliza Django 5.1.4 y Django REST Framework 3.15.2. El proyecto se encuentra en `apps/backend`.

## Estructura

| Ruta | Responsabilidad |
| --- | --- |
| `config` | Configuración global, URLs, WSGI y Celery |
| `apps/identity` | Usuarios, autenticación y perfil |
| `apps/permissions` | Roles, permisos y overrides |
| `apps/audit` | Auditoría de mutaciones y sesiones |
| `apps/notifications` | Notificaciones internas |
| `apps/production` | Funciones de producción |
| `apps/quality` | Funciones de calidad |
| `apps/maintenance` | Funciones de mantenimiento |
| `apps/warehouse` | Funciones de almacén |
| `apps/manufacturing` | Dominio de manufactura; revisión funcional separada |
| `apps/analytics` | Dominio analítico; estructura actualmente limitada |
| `apps/integrations` | Abstracciones de integración |
| `apps/core` | Estructura base compartida |
| `apps/ssi_common` | Funciones compartidas de módulos SSI |

También existen `ssi_attendance` y `ssi_chairs` dentro del árbol del backend. Su documentación se agrupa con los módulos SSI.

## Configuración

La configuración común reside en `config/settings/base.py`.

El entorno de desarrollo utiliza `config/settings/development.py`.

No existe actualmente un archivo `production.py` dentro de `config/settings`. Sí existe un conjunto de dependencias de producción en `requirements/production.txt`.

## Base de datos

La base principal del backend es PostgreSQL.

Django utiliza el usuario personalizado `identity.User` mediante `AUTH_USER_MODEL`.

Las integraciones con SQL Server y Plex no deben confundirse con la base administrada por Django. Cuando un módulo consulta esas fuentes debe identificar explícitamente que son datos externos.

## API

La API se publica bajo `/api/v1`.

Django REST Framework tiene configurada autenticación JWT como mecanismo predeterminado y `IsAuthenticated` como permiso global.

La paginación predeterminada es `PageNumberPagination` con tamaño de página 50.

El renderer predeterminado es JSON.

## JWT

Simple JWT utiliza `employee_id` como identificador de usuario y claim principal.

El access token tiene una vigencia configurada de 60 minutos.

El refresh token tiene una vigencia configurada de siete días.

La rotación y blacklist de refresh tokens están activadas.

## Caché

En desarrollo, Django utiliza `django_redis.cache.RedisCache`.

La ubicación se obtiene de `REDIS_URL`.

El prefijo de claves configurado es `mes_dev`.

Existe además `PLEX_CACHE_TTL = 300` en la configuración base. Los módulos que consumen Plex deben documentar de manera individual cómo utilizan este TTL y qué claves generan.

## Celery

Celery se inicializa en `config/celery.py` con nombre de aplicación `mes`.

Las tareas se descubren automáticamente desde las aplicaciones Django.

El broker de desarrollo utiliza Redis.

Los resultados se almacenan mediante `django-celery-results`.

Celery Beat utiliza el scheduler respaldado por base de datos.

El límite general de ejecución de tareas es de 30 minutos.

## Tareas programadas registradas en configuración

| Nombre | Función | Programación |
| --- | --- | --- |
| `cogp-weekly-offenders-saturday` | Staging semanal de offenders COGP | Sábado 07:00 |
| `maintenance-weekly-offenders-saturday` | Staging semanal de offenders de mantenimiento | Sábado 07:15 |

Las horas usan la zona horaria configurada por Django: `America/Monterrey`.

## Archivos y media

Los archivos cargados por usuarios se almacenan bajo `MEDIA_ROOT`, actualmente `apps/backend/media` respecto al proyecto ejecutado.

Django sirve `MEDIA_URL` durante la configuración actual mediante la incorporación de rutas estáticas en `config/urls.py`.

## Dependencias relevantes

Además de Django y DRF, el backend incluye Redis, Celery, pyodbc, pymssql, httpx, requests, Pillow, WeasyPrint, ReportLab y openpyxl.

La existencia de una dependencia no implica que sea usada por todos los módulos.

## Observaciones de configuración

`config/urls.py` declara dos veces el prefijo de mantenimiento. El comportamiento no se modifica como parte de la documentación.

El archivo raíz `requirements.txt` contiene únicamente entradas repetidas de `requests` y no representa el conjunto completo de dependencias. Las definiciones mantenidas se encuentran en `requirements/base.txt`, `development.txt` y `production.txt`.

La configuración de desarrollo permite todos los hosts y todos los orígenes CORS. Esta condición debe considerarse específica de desarrollo y no una política de producción.

Existen secretos y valores de conexión versionados actualmente. Deben migrarse fuera del repositorio antes de considerar una configuración de producción endurecida.
