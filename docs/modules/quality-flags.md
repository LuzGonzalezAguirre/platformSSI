# Calidad: Piezas Flageadas (Flags)

## Alcance

Vista exclusivamente de consulta bajo `/quality/flags`, dentro del grupo Q-Wall de Calidad.

Se reutilizan el selector de fechas, el catálogo dinámico de Business Units, el diseño de tarjetas y el patrón de fotografías ya implementados en el reporte de rechazos.

## Flujo de datos

`React -> GET /api/v1/quality/flags/ -> QWallRepository -> GET /piece-flags -> SQL Server CCS`.

La fuente de verdad es `ssi_PieceFlagRecords`, enlazada por `product_id` con `ssi_Products` y `ssi_PartNumbers`. La asociación de la inspección es opcional. Se muestran fecha, número de parte, BU, seriales, work order, modo de falla, comentario e inspector cuando existe una inspección relacionada.

Los filtros soportados son `start_date`, `end_date` y `bu_id`. Cada registro corresponde a un `flag_id`; no se colapsan varias marcas sobre una misma inspección. Las fechas filtran por `pfr.created_at`.

El endpoint Django aplica `quality.view` y acepta solo GET/HEAD/OPTIONS. No existen métodos para editar, eliminar o aprobar flags.

## Detalle de inspección

El detalle visual presenta únicamente Point, BU, Inspector, Date y Work Order, además de los comentarios y fotografías ya existentes. Serial Number, Frame SN y FPCA SN dejan de mostrarse en la interfaz.

Point procede del último resultado de inspección enlazado a `inspection_id`, usando `ssi_InspectionResults` y `ssi_InspectionPoints` sin multiplicar filas de Flags. Date utiliza `ssi_Inspections.started_at` y, si no existe inspección vinculada, recurre a `ssi_PieceFlagRecords.created_at`. El dato de punto queda vacío cuando no existe resultado de inspección.

## Filtros de consulta

Los filtros de fecha y Business Unit determinan qué registros se obtienen desde CCS.
Sobre el conjunto cargado se aplican, de manera combinada y sin consultar SQL de nuevo:

- **Número de parte:** búsqueda parcial sin distinguir mayúsculas y minúsculas sobre `part_number` (columna CCS `ssi_PartNumbers.ssiPN`).
- **Modelo:** selector de los modelos presentes en el rango de Flags obtenido. El valor procede de `ssi_PartNumbers.volvoProductNumber`, también expuesto por el catálogo de partes del Q-Wall Proxy. Si un registro no tiene modelo, se mantiene en la lista cuando no hay filtro de modelo.
- **WO:** búsqueda parcial sobre `work_order` (`ssi_Products.workOrder`). Se conserva como texto para aceptar órdenes con ceros a la izquierda.

El botón «Limpiar filtros» reinicia exclusivamente parte/modelo/WO. El conteo mostrado corresponde a los resultados visibles. Estos filtros locales no modifican ni escriben datos de CCS.

## Fotografías confirmadas y consulta corregida

Se confirmó mediante una consulta directa a CCS que los 53 Flags verificados tienen una fotografía relacionada en `dbo.ssi_RejectionPhotos` por `inspection_id`.

El endpoint `GET /piece-flags` usa las relaciones confirmadas entre `ssi_PieceFlagRecords`, `ssi_Products`, `ssi_PartNumbers` y `ssi_RejectionPhotos`. Agrupa por `flag_id` y devuelve `part_number`, seriales, `total_photos` y `has_photo` sin repetir flags por número de fotos.

`GET /piece-flags/{flag_id}/photos` recupera las fotografías de la inspección asociada a un Flag; Django las entrega al frontend mediante `GET /api/v1/quality/flags/{flag_id}/photos/`. Esta ruta tiene únicamente permiso de lectura `quality.view`.

El frontend obtiene las fotografías al abrir el detalle, evitando transferir imágenes de los 53 registros al cargar el listado.

## Despliegue requerido en Windows

El Q-Wall Proxy se ejecuta **fuera de Docker** en el host Windows. Fusionar GitHub y reiniciar únicamente Django no aplica nuevas consultas SQL del proxy: hay que hacer `git pull origin main` y **reiniciar el proceso Uvicorn** que ejecuta `apps/qwall-proxy/main.py`.

El caché de Flags se versionó para evitar reutilizar payloads antiguos. El endpoint Django rechaza una respuesta de proxy obsoleta con un mensaje explícito en vez de presentar fotos y números de parte vacíos.

## Verificación pendiente en el entorno

- Ejecutar las pruebas de Django y el build TypeScript.
- Probar el proxy ante registros con y sin `inspection_id`.
- Confirmar que el esquema CCS desplegado contiene las columnas usadas por el reporte.
- Identificar la fuente oficial de fotografías de Flags y verificar múltiples fotos por flag, si existen.
- Validar con cuentas que tengan y no tengan `quality.view`.
