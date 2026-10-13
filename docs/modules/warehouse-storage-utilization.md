# WH Storage Utilization

## Alcance

El módulo Materials / Materiales incluye el nuevo acceso WH Storage Utilization sin cambiar rutas de Demand ni Clear To Build.

La vista contiene 55 racks (TJR1–TJR55) y cuatro ubicaciones por rack (01–04), total 220 ubicaciones. Las cifras entregadas en el Excel se utilizan como estado inicial, con los racks aún sin posiciones asignadas sobre el plano.

## Cálculo

Cada rack define un tipo de pallet. Euro: capacidad 3 por ubicación (1=33.33%, 2=66.67%, 3=100%). Standard: capacidad 2 (1=50%, 2=100%). Una ubicación vacía equivale a 0%. La ocupación global es el promedio del porcentaje exacto de ocupación de las 220 ubicaciones.

Los porcentajes 67% se interpretan inicialmente como dos euro pallets. Se asigna tipo estándar a los racks con ubicaciones en 50%: TJR22, TJR31, TJR45, TJR47, TJR54. Esta es una inferencia operacional de los datos y requiere confirmación física antes de utilizarse como inventario oficial. Los valores 100% por sí solos no identifican el tipo de pallet.

La cifra del Excel (95%) sirve como referencia, no como cálculo forzado; el porcentaje en pantalla se calcula siempre a partir de los conteos persistidos.

## API y almacenamiento

- GET /api/v1/warehouse/storage-utilization/: configuración, racks y conteos.
- PATCH /api/v1/warehouse/storage-utilization/: actualiza un rack (number, pallet_type, levels, x/y, width/height, rotation) o designer_enabled.

Los datos se guardan en PostgreSQL mediante `warehouse_storage_layout`, `warehouse_storage_rack`, `warehouse_storage_location`. Aplicar `python manage.py migrate` antes de habilitar la página.

El permiso `warehouse.view` permite consultar; `warehouse.edit` es obligatorio para modificar conteos, tipo de pallet y layout. Los datos iniciales se generan una sola vez por rack si no existen; volver a cargar la página no sobrescribe las modificaciones.

## Diseñador

La pantalla de Settings permite activar el diseñador. Sin configuración visual, la página muestra un canvas vacío estilizado y la lista de racks. El usuario con permiso de edición puede seleccionar un rack, definir posición y tamaño porcentual, arrastrarlo y rotarlo. El botón de pantalla completa amplía el área del almacén.

La distribución por defecto no pretende representar un plano físico real. Para reproducir la posición y proporciones exactas del almacén se requiere una imagen/plano del almacén.

## Limitaciones

La utilización es manual y no se sincroniza automáticamente con el inventario Plex. Las modificaciones se comparten vía API, aunque la página no tiene actualización push entre sesiones. La coexistencia de pallets de distintos formatos en una misma ubicación requiere extender el modelo: actualmente el tipo se define por rack.
