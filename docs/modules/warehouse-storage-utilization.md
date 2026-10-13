# WH Storage Utilization

## Alcance

Materials / Materiales contiene dos pantallas independientes: WH Storage Utilization y WH Storage Designer. El módulo controla 55 racks TJR1–TJR55, cada uno con cuatro localidades TJRn-01…04 (220 en total). Las funciones de Demand y Clear To Build no se modifican.

## Vista automática

La vista operativa siempre muestra los racks, agrupados en cinco zonas (1–13, 14–26, 27–37, 38–48 y 49–55). Cada rack presenta sus cuatro localidades coloreadas por ocupación y puede seleccionarse para editar cantidades. No es necesario configurar el diseñador para consultar o modificar el inventario manual.

Cuando el diseñador está activado y se han ubicado racks, la vista operativa presenta también el plano físico guardado. No reemplaza la vista automática.

## Pallets mixtos

Los conteos se mantienen a nivel de localidad:

- `standard_pallets`: cada uno ocupa 1/2 de localidad.
- `euro_pallets`: cada uno ocupa 1/3 de localidad.

La utilización exacta es `100 * (standard_pallets / 2 + euro_pallets / 3)`. El servidor rechaza valores negativos, no enteros o cuya combinación exceda 100%. Son válidos dos estándar, tres europeos, uno de cada uno (83.33%), o una localidad vacía. La ocupación global se calcula promediando los porcentajes de las 220 localidades.

Los porcentajes históricos de Excel se interpretaron como conteos iniciales. Los datos existentes se migran conservando la interpretación anterior por rack para evitar pérdida de información. Los porcentajes históricos no permiten confirmar qué tipo físico de pallet está almacenado; esta información debe verificarse en planta.

## API y almacenamiento

- `GET /api/v1/warehouse/storage-utilization/`: devuelve configuración, racks y localidades.
- `PATCH /api/v1/warehouse/storage-utilization/`: actualiza ocupación por localidad, coordenadas de un rack o preferencia del diseñador.

Django/PostgreSQL: tablas `warehouse_storage_layout`, `warehouse_storage_rack`, `warehouse_storage_location`. La migración `0002_mixed_pallets` copia los conteos heredados a los nuevos campos y `0003_remove_legacy_pallet_fields` retira las columnas antiguas. Ejecutar `python manage.py migrate` al desplegar.

Permisos: `warehouse.view` para lectura y `warehouse.edit` para alterar layout y cantidades. La validación se realiza también en el servidor.

## Diseñador independiente

Ruta: `/warehouse/storage-layout-designer`. Con el diseñador habilitado en Settings, una persona con permiso de edición puede arrastrar un rack de la biblioteca de localidades TJR al canvas, posicionarlo, redimensionarlo, rotarlo o retirarlo del plano sin borrar sus conteos. Los cambios se guardan en PostgreSQL.

El plano representa una configuración manual, no la geografía real hasta que se mapeen las ubicaciones físicas. La página operativa conserva siempre el mapa automático. No existe sincronización de conteos con Plex, actualización push multiusuario, ni un plano de fondo cargado.

## Validaciones recomendadas

1. Ejecutar migraciones y verificar que los registros antiguos mantienen su ocupación.
2. Probar un estándar + un euro (83.33%), dos estándar (100%), tres euro (100%), y combinaciones inválidas (>100%).
3. Comprobar permisos de lectura y edición desde la API.
4. Probar drag & drop y guardado del diseñador en escritorio.
5. Verificar renderizado y compilación del frontend antes del despliegue.
