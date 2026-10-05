# Mapa del repositorio

## Raíz

| Ruta | Contenido |
| --- | --- |
| `apps` | Aplicaciones ejecutables |
| `docs` | Documentación técnica |
| `ops` | Recursos operativos |
| `scripts` | Scripts auxiliares |
| `startapp` | Scripts de arranque del host |
| `docker-compose.yml` | Definición de servicios locales |

## Backend

`apps/backend` contiene el proyecto Django.

| Aplicación | Clasificación documental inicial |
| --- | --- |
| analytics | Estructura presente; revisión detallada pendiente |
| audit | Implementación presente |
| core | Estructura base |
| identity | Implementación presente |
| integrations | Estructura de integración |
| maintenance | Implementación presente |
| manufacturing | Estructura presente; revisión detallada pendiente |
| notifications | Implementación presente |
| permissions | Implementación presente |
| production | Implementación presente |
| quality | Implementación presente |
| ssi_attendance | Módulo SSI; revisión detallada pendiente |
| ssi_chairs | Módulo SSI; revisión detallada pendiente |
| ssi_common | Funciones comunes SSI |
| warehouse | Implementación presente |

La clasificación anterior es únicamente una guía de inventario. El estado definitivo de cada módulo se documentará a partir de sus modelos, URLs, vistas, servicios, repositorios, tareas y pruebas.

## Configuración Django

`apps/backend/config` contiene configuración global, rutas, inicialización de Celery y entrada WSGI.

La configuración se divide en el directorio `config/settings`, con una base común y configuraciones específicas de entorno.

## Frontend

`apps/frontend/src` contiene la aplicación React.

| Ruta | Responsabilidad |
| --- | --- |
| `components` | Componentes reutilizables y layout |
| `i18n` | Internacionalización |
| `lib` | Utilidades de soporte |
| `modules` | Módulos funcionales |
| `navigation` | Definición del menú, roles y comportamiento de navegación |
| `services` | Clientes y servicios compartidos |
| `store` | Estado global |
| `styles` | Tokens y estilos compartidos |

## Módulos frontend

| Área | Contenido observado |
| --- | --- |
| admin | Usuarios, roles y auditoría |
| auth | Login y autenticación |
| incoming-inspection | Inspección de recibo |
| maintenance | Overview, work requests, PMP, corrective actions y equipos caídos |
| notifications | Centro de notificaciones |
| operational-panel | Panel operacional |
| production | Ops report, targets, safety, assistance y ley silla |
| profile | Perfil de usuario |
| quality | Dashboard, Q-Wall, COGP, downtime, rejection report y problem control |
| qwall-settings | Configuración específica de Q-Wall |
| ssi | Attendance, chair control y safe launch |
| warehouse | BOM, demanda y Clear to Build |

## Proxies

`apps/qwall-proxy` contiene el proxy FastAPI para SQL Server.

El proxy de Plex se arranca desde scripts del repositorio, pero su implementación principal no se encuentra dentro de `apps` en el estado revisado. Esta diferencia debe quedar explícita en la documentación operativa para evitar asumir que todos los servicios están incluidos en Docker Compose.

## Scripts SQL

`scripts/sql` contiene scripts de soporte para estructuras y procesos de SQL Server relacionados con funciones operativas, entre ellas mantenimiento y Q-Wall.

`ops/db` contiene scripts de reconciliación o cambios de base asociados a operación.

Estos archivos deben documentarse por propósito y dependencia antes de utilizarlos como procedimiento de instalación.
