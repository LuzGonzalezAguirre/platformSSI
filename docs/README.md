# Documentación técnica de platformSSI

## Objetivo

Este directorio contiene la documentación técnica mantenible de platformSSI. Su objetivo es permitir entender el sistema sin depender de conocimiento informal, describiendo cómo está construido, cómo se ejecuta, cómo se conectan sus componentes y qué responsabilidad pertenece a cada módulo.

La documentación se construye a partir del estado real del repositorio. No se considera terminada una sección hasta que su contenido haya sido contrastado contra código, configuración, rutas, modelos, servicios y tareas correspondientes.

## Índice

| Documento | Alcance | Estado |
| --- | --- | --- |
| `architecture/system-overview.md` | Arquitectura general, componentes y flujo de datos | Documentado |
| `architecture/repository-map.md` | Estructura lógica del repositorio | Documentado |
| `documentation-standards.md` | Criterios para mantener la documentación | Documentado |
| `backend/README.md` | Arquitectura Django y configuración transversal | Documentado |
| `backend/identity-permissions-audit.md` | Identidad, roles, permisos y auditoría | Documentado |
| `backend/notifications.md` | Notificaciones persistentes y tareas de usuario | Documentado |
| `modules/production.md` | Producción, Ops Report, targets, seguridad, asistencia y productividad | Documentado |
| `modules/quality.md` | Visión general del dominio de Calidad | Documentado |
| `modules/quality-qwall.md` | Q-Wall, catálogo, pass rate y lot sampling | Documentado |
| `modules/quality-cogp.md` | COGP, scrap rate y offenders | Documentado |
| `modules/quality-problem-control.md` | Problem Control y flujo 8D | Documentado |
| `modules/quality-incoming-downtime.md` | Incoming Inspection y Downtime de Calidad | Documentado |
| `modules/maintenance.md` | Overview, Work Requests, equipos caídos, PMP y Corrective Actions | Documentado |
| `modules/warehouse.md` | Demand, BOM Explorer y Clear to Build | Documentado |
| `modules/ssi.md` | SSI common y estado de Attendance, Chair Control y Safe Launch | Documentado |
| `frontend/README.md` | Router, navegación, autenticación, estado, i18n y cliente HTTP | Documentado |
| `integrations/README.md` | Plex, Q-Wall, SQL Server y sistemas externos | Pendiente |
| `operations/README.md` | Docker, arranque, migraciones, Celery y operación | Pendiente |
| `data/README.md` | Bases de datos, ownership de datos y scripts SQL | Pendiente |

## Criterio de estado

`Documentado` significa que la sección fue revisada contra el código actual.

`Parcial` significa que existe documentación válida, pero faltan componentes o flujos por cubrir.

`Pendiente` significa que el documento forma parte del plan documental pero todavía no ha sido completado.

## Regla de mantenimiento

Cuando un cambio modifique rutas, modelos, integraciones, jobs, configuración de despliegue, estructuras de datos o reglas de negocio, el mismo cambio debe actualizar la documentación correspondiente.
