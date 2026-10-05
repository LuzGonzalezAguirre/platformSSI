# platformSSI

## Propósito

platformSSI es una plataforma interna de operación industrial que concentra funciones de producción, calidad, mantenimiento, almacén, administración y soporte operativo en una sola aplicación web.

El repositorio contiene una aplicación Django con Django REST Framework, un frontend React con TypeScript y Vite, procesamiento asíncrono con Celery y Redis, persistencia principal en PostgreSQL e integraciones con sistemas externos mediante servicios proxy.

La documentación técnica se mantiene en el directorio `docs`. El código fuente continúa siendo la referencia definitiva cuando exista una diferencia entre una descripción documental y la implementación.

## Estructura principal

| Ruta | Responsabilidad |
| --- | --- |
| `apps/backend` | API, autenticación, permisos, lógica de negocio, persistencia y tareas asíncronas |
| `apps/frontend` | Aplicación web React, navegación, vistas, estado cliente y acceso a API |
| `apps/qwall-proxy` | Servicio FastAPI para acceso controlado a información y operaciones de Q-Wall en SQL Server |
| `docs` | Documentación técnica del sistema |
| `ops` | Scripts y recursos operativos relacionados con base de datos |
| `scripts` | Scripts auxiliares, principalmente SQL |
| `startapp` | Arranque local y operativo de servicios |
| `docker-compose.yml` | Orquestación local de PostgreSQL, Redis, backend, Celery y frontend |

## Arquitectura resumida

El navegador consume el frontend React. El frontend utiliza la API REST de Django bajo `/api/v1`. Django utiliza PostgreSQL como base principal y Redis como infraestructura de caché y mensajería para Celery.

Las integraciones que requieren conectividad o controladores específicos del host se mantienen fuera de los contenedores principales. El backend accede al proxy de Plex mediante `PLEX_PROXY_URL` y al proxy de Q-Wall mediante `QWALL_PROXY_URL`. El servicio Q-Wall consulta SQL Server mediante ODBC.

Celery ejecuta trabajos asíncronos y Celery Beat programa procesos recurrentes. En la configuración actual existen procesos semanales para COGP y mantenimiento.

## Documentación

El índice completo se encuentra en `docs/README.md`.

La documentación está organizada por arquitectura, backend, frontend, módulos funcionales, integraciones, datos y operación. Cada módulo debe indicar su propósito, rutas, dependencias, fuentes de datos, estado actual y limitaciones conocidas.

## Estado del repositorio

Este repositorio contiene módulos completamente implementados, módulos parciales y estructuras reservadas para desarrollo posterior. La presencia de una carpeta no implica que el módulo esté terminado.

Durante la documentación se conserva esta distinción para evitar describir funcionalidad que no existe en el código.
