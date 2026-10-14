# Calidad: Piezas Flageadas (Flags)

## Alcance

Vista exclusivamente de consulta bajo `/quality/flags`, dentro del grupo Q-Wall de Calidad.

Se reutilizan el selector de fechas, el catálogo dinámico de Business Units, el diseño de tarjetas y el patrón de fotografías ya implementados en el reporte de rechazos.

## Flujo de datos

`React -> GET /api/v1/quality/flags/ -> QWallRepository -> GET /piece-flags -> SQL Server CCS`.

La fuente de verdad es `ssi_PieceFlagRecords`, enlazada por `product_id` con `ssi_Products` y `ssi_PartNumbers`. La asociación de la inspección es opcional. Se muestran fecha, número de parte, BU, seriales, work order, modo de falla, comentario e inspector cuando existe una inspección relacionada.

Los filtros soportados son `start_date`, `end_date` y `bu_id`. Cada registro corresponde a un `flag_id`; no se colapsan varias marcas sobre una misma inspección. Las fechas filtran por `pfr.created_at`.

El endpoint Django aplica `quality.view` y acepta solo GET/HEAD/OPTIONS. No existen métodos para editar, eliminar o aprobar flags.

## Fotografías: límite actual

La única fuente fotográfica verificada en el repositorio es `ssi_RejectionPhotos`, asociada por `inspection_id`. El listado utiliza `has_photo` cuando existe una foto de rechazo vinculada, y la consulta del detalle reutiliza `GET /quality/rejection-photo/{inspection_id}/`.

**No se ha confirmado el nombre o contrato de almacenamiento de imágenes propias de Flags.** Una pieza flageada sin foto vinculada en `ssi_RejectionPhotos` se presenta como "Sin fotografía vinculada". Esto no significa que la pieza no tenga fotografías en otro sistema. Para soportar todas las imágenes de Flags hace falta validar tabla/columnas y la asociación al `flag_id` en CCS.

No se guardan ni modifican fotos, comentarios o estados desde platformSSI.

## Verificación pendiente en el entorno

- Ejecutar las pruebas de Django y el build TypeScript.
- Probar el proxy ante registros con y sin `inspection_id`.
- Confirmar que el esquema CCS desplegado contiene las columnas usadas por el reporte.
- Identificar la fuente oficial de fotografías de Flags y verificar múltiples fotos por flag, si existen.
- Validar con cuentas que tengan y no tengan `quality.view`.
