# Q-Wall Designer — integración inicial

## Alcance

Este cambio incorpora la interfaz del repositorio `qwall-designer` a la navegación
y autenticación de platformSSI. No instala otro servidor Django, token de
inicio de sesión ni conexión ODBC directa en el contenedor.

Ruta de interfaz: `/quality/qwall/designer`.
Rutas backend: `/api/v1/quality/qwall/designer/{resource}/`.

## Estado de integración

El editor React original fue migrado inicialmente a TSX con comprobación de
tipos temporalmente deshabilitada para permitir una migración incremental.
NO se considera validado en compilación o en tableta Windows. El menú y la
ruta requieren permiso `quality.edit`.

La API Django delega en el servicio definido por `QWALL_PROXY_URL`.
El proxy existente deberá implementar `/designer/*` antes de habilitar
el editor a usuarios de producción. No hay prueba disponible que demuestre
que esos endpoints existen actualmente.

## Contrato requerido para qwall-proxy

Los recursos son:

- `/designer/business-units`: GET.
- `/designer/part-numbers`: GET y POST, filtro opcional `bu_id`.
- `/designer/inspection-points`: GET y POST, filtro opcional `bu_id`.
- `/designer/steps`: GET y POST, filtros `bu_id`, `part_number`.
- `/designer/steps/{id}`: GET, PATCH y DELETE.
- `/designer/steps/{id}/save_positions`: POST, reemplazo transaccional de posiciones.
- `/designer/steps/{id}/update_image`: POST.
- `/designer/steps/{id}/clone_to_models`: POST.
- `/designer/steps/{id}/publish`: POST.

Para compatibilidad, el JSON debe corresponder a los serializers actuales de
`qwall-designer/backend/steps/serializers.py`, incluyendo `positions` y
`step_image_base64`.

## Requisitos antes del despliegue

1. Implementar las operaciones en el qwall-proxy que posee conectividad a CCS,
   usando consultas parametrizadas y transacciones SQL Server.
2. Revisar el flujo borrador/publicación: nunca sobrescribir una versión
   publicada utilizada por QWall Windows sin una activación controlada.
3. Validar pertenencia de parte y punto de inspección a la misma BU.
4. Agregar validaciones del lado servidor para Base64, MIME, tamaño máximo,
   nombres y posiciones. Exigir valores positivos para dimensiones.
5. Corregir transformaciones de coordenadas del canvas, incluidas áreas
   vacías de PictureBox Zoom y cambios de tamaño en tableta.
6. Migrar TSX a tipado estricto y reemplazar diálogos `alert/confirm` por UI.
7. Ejecutar compilación frontend, pruebas backend, pruebas de permisos y de
   compatibilidad visual contra QWall Windows.
8. Eliminar entornos virtuales versionados del repositorio fuente en una
   limpieza independiente; no copiar secretos/configuraciones de desarrollo.
9. Revisar rotación de la clave expuesta en el repositorio fuente si
   alguna vez fue utilizada fuera del entorno de desarrollo.

## Seguridad y permisos

El backend valida acciones con `PermissionService` para `quality`.
Los endpoints de edición y publicación requieren `quality.edit`. A futuro
se recomienda un permiso granular de publicación, validación de alcance por
BU en el servidor y auditoría del usuario responsable de cada versión.

No fusionar a `main` hasta cubrir los requisitos anteriores.
