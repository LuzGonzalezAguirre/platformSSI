# Operación y despliegue

## Alcance

Este documento describe cómo se ejecuta platformSSI a partir de los artefactos versionados actualmente.

No define todavía una arquitectura de producción endurecida. El repositorio utiliza imágenes y servidores de desarrollo para backend y frontend.

## Servicios Docker

`docker-compose.yml` define seis servicios.

| Servicio | Contenedor | Responsabilidad |
| --- | --- | --- |
| db | PostgreSQL 16 Alpine | Base de datos Django |
| redis | Redis 7 Alpine | Caché y broker Celery |
| backend | Python 3.12 | Django REST |
| celery_worker | Python 3.12 | Tareas asíncronas |
| celery_beat | Python 3.12 | Scheduler |
| frontend | Node 20 Alpine | Vite development server |

Plex Proxy y Q-Wall Proxy no forman parte de Docker Compose.

## Configuración de ambiente

La raíz contiene `.env.example` como contrato de configuración.

Antes de iniciar el sistema en un host nuevo se debe copiar a `.env` y completar los valores reales. `.env` está ignorado por Git y no debe versionarse.

Variables obligatorias para el runtime actual:

- `DJANGO_SECRET_KEY`;
- `POSTGRES_PASSWORD`;
- `REDIS_PASSWORD`;
- `PLEX_PROXY_SECRET`;
- `QWALL_PROXY_TOKEN`;
- `QWALL_DB_CONN_STR`.

Las URLs y nombres no sensibles disponen de defaults de desarrollo cuando el contrato lo permite.

Q-Wall Proxy corre en el host Windows. Su módulo `config.py` lee el mismo `.env` de la raíz antes de resolver las variables requeridas, de modo que Docker y el proxy del host comparten una sola fuente operativa sin guardar secretos en código.


## PostgreSQL

El servicio expone el puerto PostgreSQL al host.

Utiliza un volumen persistente:

`postgres_data`.

Tiene healthcheck mediante `pg_isready`.

El nombre de base y usuario pueden conservar valores de desarrollo, pero la contraseña se obtiene obligatoriamente de `POSTGRES_PASSWORD`.

Docker Compose falla antes de iniciar si la contraseña requerida no está definida.

## Redis

Redis utiliza un volumen:

`redis_data`.

La configuración actual:

- requiere contraseña;
- limita memoria a 512 MB;
- usa `allkeys-lru`;
- expone el puerto al host;
- tiene healthcheck.

La contraseña se obtiene de `REDIS_PASSWORD` y se utiliza para construir `REDIS_URL` en los servicios Django/Celery. No existe un password funcional de respaldo en Compose.

## Backend

Imagen de desarrollo:

`apps/backend/Dockerfile.dev`.

Base:

`python:3.12-slim`.

Instala dependencias de compilación, PostgreSQL/ODBC y bibliotecas necesarias para generación de PDF.

El contenedor monta `apps/backend` como volumen sobre `/app`.

Comando actual:

`python manage.py runserver 0.0.0.0:8000`.

Django `runserver` es un servidor de desarrollo y no debe utilizarse como servidor WSGI/ASGI definitivo de producción.

## Frontend

Imagen:

`apps/frontend/Dockerfile.dev`.

Base:

`node:20-alpine`.

Instala dependencias mediante `npm install`.

El contenedor monta el código fuente y conserva `node_modules` dentro del contenedor.

Comando:

`npm run dev -- --host 0.0.0.0`.

Vite dev server tampoco representa una configuración de producción.

## Celery Worker

El worker utiliza la misma imagen que Django.

Comando actual:

`celery -A config worker --loglevel=info --concurrency=4`.

Dependencias externas relevantes:

- PostgreSQL;
- Redis;
- Plex Proxy;
- Q-Wall Proxy para ciertas tareas.

El script de arranque valida que la credencial de Plex esté disponible dentro del worker antes de permitir el flujo operativo completo.

## Celery Beat

Comando:

`celery -A config beat --loglevel=info --scheduler django_celery_beat.schedulers:DatabaseScheduler`.

El scheduler usa las tablas de `django-celery-beat`.

La configuración base también define tareas estáticas mediante `CELERY_BEAT_SCHEDULE`.

Tareas semanales actuales:

| Tarea | Programación |
| --- | --- |
| COGP offenders | Sábado 07:00 |
| Maintenance offenders | Sábado 07:15 |

Zona horaria:

`America/Monterrey`.

El worker ejecuta la tarea; Beat solamente la publica.

## Proxies del host

### Plex

El script de arranque espera un Plex Proxy ubicado fuera de este repositorio.

El proceso se ejecuta con Uvicorn en el host y se intenta reiniciar después de una salida.

### Q-Wall

El Q-Wall Proxy sí vive en este repositorio, pero se ejecuta fuera de Docker porque utiliza Windows Integrated Security y ODBC SQL Server.

Se inicia con Uvicorn en el host.

## Flujo de arranque versionado

El archivo `startapp/platformSSI.bat` expresa el siguiente procedimiento:

1. comprobar Docker;
2. iniciar Docker Desktop si no responde;
3. iniciar Plex Proxy;
4. iniciar Q-Wall Proxy;
5. recrear backend, worker, beat y frontend;
6. validar secreto Plex en Celery;
7. ejecutar migraciones Django;
8. publicar la dirección de acceso.

## Estado de los scripts .bat

Los archivos versionados dentro de `startapp` no contienen únicamente comandos Batch.

Su contenido usa la forma de here-string de PowerShell:

`@" ... "@ | Out-File ...`.

Esto sugiere que fueron guardados como scripts generadores de archivos Batch, aunque su extensión actual es `.bat`.

Debe verificarse el procedimiento real utilizado en el servidor.

No se debe asumir que ejecutar estos archivos directamente con `cmd.exe` es equivalente a ejecutar el cuerpo batch que aparece dentro del here-string.

La corrección futura debería elegir una de dos opciones:

- guardar Batch real en archivos `.bat`; o
- convertirlos explícitamente a `.ps1` y documentar que generan scripts Batch.

## Migraciones Django

El procedimiento estándar para cambios de esquema PostgreSQL debe ser:

`python manage.py makemigrations --check`

para verificar diferencias no capturadas cuando corresponda, y:

`python manage.py migrate`

para aplicar migraciones existentes.

El script de arranque ejecuta `migrate`.

No ejecuta `makemigrations`, lo cual es correcto para despliegue: las migraciones deben estar creadas y revisadas antes de desplegar.

## Scripts SQL directos

El repositorio contiene scripts que no son migraciones Django.

Estos scripts deben ejecutarse únicamente contra la base correspondiente y con revisión previa.

### PostgreSQL reconciliation

`ops/db/2026-08-05_prod_reconcile.sql` modifica directamente estructuras del esquema PostgreSQL relacionadas con identidad y Safety.

Es un artefacto de reconciliación fechado.

No debe convertirse en el mecanismo normal de evolución del esquema.

La fuente canónica para cambios Django debe continuar siendo migrations.

Antes de reutilizar este script debe verificarse si los cambios ya están representados por las migraciones actuales.

### SQL Server scripts

`scripts/sql` contiene DDL destinado a CCS.

Estos scripts no son aplicados por `python manage.py migrate`.

Su ejecución requiere una operación separada contra SQL Server.

## Health y dependencias

Compose tiene healthchecks para PostgreSQL y Redis.

No contiene healthchecks declarativos para:

- backend;
- worker;
- beat;
- frontend;
- Plex Proxy;
- Q-Wall Proxy.

Q-Wall Proxy sí publica `/health`, pero Compose no lo consume porque el proxy corre fuera de Compose.

No se observó un health contract equivalente del Plex Proxy dentro de este repositorio.

## Orden de dependencias

El backend espera PostgreSQL y Redis saludables.

Celery Worker depende del backend.

Celery Beat depende del backend y del worker.

Estas dependencias de Compose ordenan el inicio, pero no garantizan disponibilidad de Plex o Q-Wall.

Los services deben seguir manejando fallos de integración explícitamente.

## Datos persistentes

Persistencia local Docker:

- PostgreSQL: `postgres_data`;
- Redis: `redis_data`.

Media de Django se encuentra bajo `apps/backend/media` dentro del bind mount y está ignorado por Git.

Los archivos de media no cuentan con una política de backup versionada en este repositorio.

## Backups y restore

No se observó un procedimiento de backup/restore automatizado dentro del repositorio.

Antes de tratar platformSSI como despliegue recuperable deben documentarse y probarse por separado:

- backup PostgreSQL;
- restore PostgreSQL;
- backup de media;
- dependencia de backups de CCS;
- estrategia de recuperación de Plex;
- conservación de Redis si algún flujo llega a depender de datos no reconstruibles.

Redis debe tratarse como infraestructura temporal; los datos de negocio no deberían existir únicamente en Redis.

## Observabilidad

El código utiliza logging de Python en diferentes servicios, pero no existe una capa centralizada de logs o métricas dentro del repositorio.

No se observan artefactos para:

- log aggregation;
- tracing distribuido;
- métricas Prometheus;
- dashboards de infraestructura;
- alerting.

Una futura mejora debería separar al menos:

- logs de aplicación;
- logs de integración;
- logs de Celery;
- métricas de latencia/error por proxy;
- estado de tareas periódicas.

## CI/CD

El despliegue continúa orientado a ejecución manual en el servidor.

Existe `.github/workflows/secret-scan.yml`, que ejecuta Gitleaks en pushes a `main` y pull requests para detectar secretos versionados.

Siguen pendientes pipelines para:

- backend tests;
- frontend TypeScript build;
- lint;
- migraciones faltantes;
- construcción de imágenes;
- documentación actualizada.

## Seguridad operacional

Riesgos prioritarios observados:

1. los secretos retirados del árbol activo siguen presentes en el historial Git y no fueron rotados;
2. puertos de base y Redis expuestos al host;
3. servidores de desarrollo utilizados como runtime;
4. ausencia de una configuración production Django separada;
5. scripts de arranque ambiguos por mezcla PowerShell/Batch;
6. ausencia de healthchecks de proxies dentro de la orquestación.

Las correcciones deben realizarse en commits funcionales distintos de este PR documental.
