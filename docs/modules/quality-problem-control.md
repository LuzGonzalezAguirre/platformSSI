# Calidad: Problem Control

## Propósito

Problem Control implementa un flujo 8D para registrar, investigar, contener, corregir, verificar y cerrar problemas de calidad.

El modelo central es `Problem`.

El frontend está organizado en `apps/frontend/src/modules/quality/problem-control`.

## Identificación y estado

Estados del modelo:

| Estado | Significado |
| --- | --- |
| `draft` | En edición |
| `pending_approval` | En aprobación final |
| `approved` | Todas las aprobaciones requeridas registradas |
| `closed` | Cerrado |
| `rejected` | Estado disponible en el modelo |

El número de problema se genera al crear el registro. El modelo documenta el formato `CA-WW-YY-XXXXX`.

## Información de origen

El problema contiene campos para información de cliente, proveedor, parte, departamento y workcenter.

Varios de estos campos están diseñados para guardar información obtenida de Plex, pero el Problem conserva snapshots de texto dentro de PostgreSQL.

## Flujo funcional

### D1. Define Problem

Incluye descripción, categoría, tipo, severidad, contexto, información de parte, workcenter, turno, defecto y cantidades.

Las categorías y tipos tienen choices históricos en el modelo y además existen catálogos configurables `ProblemCategoryCatalog` y `ProblemTypeCatalog`.

### D2. Define Team

El problema tiene un `champion` y múltiples `team_members`.

El champion es un usuario de platformSSI.

### D3. Initial Response y Containment

El modelo mantiene campos de initial response y una fecha objetivo.

Las acciones de contención viven en `ContainmentAction`.

Cada acción puede tener responsable, due date, completion date, estado ongoing, acción y respuesta.

### D4. Five Why y Root Cause

`FiveWhyAnalysis` separa análisis por:

- made;
- escape;
- systemic.

Las cadenas Why actuales viven en `RootCause`.

Cada RootCause contiene why1 a why5 y corrective action por nivel.

Al guardar, `root_cause` se calcula como el último Why no vacío.

El análisis se considera válido cuando por lo menos una fila tiene why1, why2 y why3 capturados.

### D5. Corrective Actions

`CorrectiveAction` debe estar vinculada a una `RootCause`.

Incluye responsable, due date, completion date, ongoing, active, acción y respuesta.

### D6. Verification

`VerificationAction` representa verificación de efectividad.

Los attachments pueden vincularse además a una CorrectiveAction como evidencia de verificación.

### D7. Prevention

`PreventionAction` registra acciones de control o prevención de recurrencia.

### D8. Final Approval

El cierre requiere cuatro owners de aprobación:

1. Quality Manager;
2. Manufacturing;
3. Production;
4. Maintenance.

El Quality Manager se obtiene de `ProblemControlSettings`, un singleton de PostgreSQL.

Los otros tres aprobadores se almacenan directamente en el Problem.

## SLA

El Problem guarda snapshots de SLA al crear el registro.

Valores predeterminados del modelo:

| Etapa | SLA |
| --- | --- |
| D3 | 48 horas |
| D4 | 10 días |
| D5 | 20 días |
| D6 | 20 días |
| D7 | 30 días |
| D8 | 30 días |

Al estar almacenados en cada Problem, cambios posteriores de configuración no alteran retroactivamente esos snapshots.

## FMEA y Control Plan

El modelo incluye responsables, flags de actualización requerida, due date, completion y re-evaluation para FMEA y Control Plan.

## Archivos

`ProblemAttachment` almacena archivos por Problem y step.

Steps definidos:

- general;
- step1;
- step2;
- step3a;
- step3b;
- step4;
- step5;
- step6;
- step7;
- step8.

El modelo documenta un máximo esperado de 10 MB por archivo.

El archivo mantiene filename, file size, usuario, fecha y descripción.

## Notas

`ProblemNote` almacena notas por step.

El flujo de aprobación reutiliza notas con prefijos internos para comentarios y rechazos de departamentos.

## Aprobación final

La presentación a aprobación falla si falta alguno de los cuatro owners.

`AssignedProblemFinalApprovalView` restringe el acceso del flujo final a los cuatro usuarios asignados.

Cada aprobador solo puede aprobar su propia sección.

El estado pasa a `approved` únicamente cuando están registradas las cuatro aprobaciones.

El payload reporta `required_count=4`.

## Rechazo

La implementación efectiva de `ProblemFinalApprovalView` hace lo siguiente ante un solo rechazo autorizado:

1. crea una nota de rechazo;
2. limpia la aprobación de Quality;
3. limpia las aprobaciones de Manufacturing, Production y Maintenance;
4. cambia el estado a `draft`;
5. permite que el 8D vuelva a editarse.

Existe un comentario en el código que afirma que aprobaciones existentes permanecen registradas hasta una edición, pero la implementación inmediatamente posterior las limpia.

La documentación considera como comportamiento efectivo lo que ejecuta el código: las cuatro aprobaciones se reinician.

Esta contradicción debe corregirse en código o comentario para evitar interpretaciones distintas.

## Configuración de aprobación

`ProblemControlSettings` mantiene únicamente una fila con `pk=1`.

Campos:

- quality_manager;
- updated_by;
- updated_at.

El modelo impide su eliminación normal y fuerza siempre pk=1.

## Notificaciones

Las acciones asignadas de Containment, Corrective, Verification y Prevention se integran con `NotificationService`.

Las asignaciones generan notificaciones internas y las acciones completadas pueden resolver la tarea asociada.

La documentación detallada está en `docs/backend/notifications.md`.

## API

Además del CRUD de Problems, el backend publica endpoints para:

- submit;
- approval;
- department approval;
- final approvals;
- reject;
- close;
- override request y approval;
- catálogos;
- settings;
- acciones D3/D5/D6/D7;
- Five Why;
- Root Cause;
- attachments;
- notes.

## Frontend

El frontend contiene páginas de lista, wizard, detalle y aprobación.

La API cliente del módulo centraliza las llamadas CRUD y del workflow.

Existe un archivo llamado `ProlemListPage.tsx`; el nombre contiene un typo en el repositorio, aunque el comportamiento de la página no depende de la ortografía del nombre de archivo.

## Auditoría

Problem Control contiene además un modelo de auditoría específico del dominio, separado de `apps.audit.AuditLog`.

Las acciones importantes del servicio pueden dejar historial del Problem.

La coexistencia de auditoría global y auditoría específica debe considerarse intencional mientras se requiera detalle de cambios del 8D.

## Riesgos y deuda técnica

La lógica de workflow está repartida entre modelos, service, serializers y múltiples views de aprobación.

La contradicción entre comentario y código en rechazo debe resolverse.

Los catálogos históricos definidos como choices y los catálogos configurables coexisten y deben consolidarse conceptualmente para evitar fuentes dobles.

Las pruebas del flujo deberían cubrir por lo menos:

- submit incompleto;
- cuatro aprobaciones;
- rechazo por cada rol;
- reapertura;
- nueva edición después de rechazo;
- cierre;
- override;
- attachments por step;
- notificaciones de responsables.
