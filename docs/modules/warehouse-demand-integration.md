# Warehouse Demand: integración y conciliación con Plex

## Alcance

La pantalla `DemandPage.tsx` consume `GET /warehouse/demand/` de Django. Django transmite los filtros a `PlexClient`, que consulta `POST /demand` del proxy ODBC `plex-proxyO`. El cambio de esta rama requiere un proxy compatible con los filtros y con `Shipper_No`. No se cambia la URL ni el token de producción automáticamente.

Los filtros son `customer_no`, `status` (`Open`, `History`, `All`), `ship_date_from`, `ship_date_to`, `po`, `customer_part_no` y `release_types` repetido por cada tipo seleccionado. Las fechas deben venir juntas, usar YYYY-MM-DD y abarcar como máximo 180 días. Los filtros de PO y parte aceptan un máximo de 100 caracteres. La clave de caché incluye todos los filtros, con tipos de release ordenados para evitar claves distintas por el orden de selección.

## Campos

`Shipper_No` procede de `Sales_v_Shipper_Line_Release`, `Sales_v_Shipper_Line` y `Sales_v_Shipper`. Una consulta adicional del proxy agrupa los números por release para evitar duplicar filas. Si no existe un embarque relacionado, devuelve una cadena vacía.

`Rel_Bal = Quantity - COALESCE(Quantity_Shipped, 0)`.

`Qty_Ready` y `Qty_WIP` son actualmente métricas de inventario físico por parte: se consideran contenedores activos con cantidad positiva, operación activa, estado permitido para embarcar, no defectuoso y no scrap. `Shippable=1` clasifica Ready; `Shippable=0` clasifica WIP. **Estas métricas no son equivalentes todavía a la asignación por release que muestra Plex Demand.** No se deben sumar entre releases de la misma parte. La interfaz las identifica expresamente como métricas de inventario.

`Requested_Ship_Date` y `Total_Rel_Due` no están calculados en el proxy y la interfaz los representa como no disponibles. **No** se sustituyen por `Preliminary_Due_Date`, `Ship_Date` o `Rel_Bal` sin evidencia de equivalencia.

## Evidencia y límites de validación

En el entorno de prueba Plex, la consulta `Open` para 2026-10-01 a 2026-10-31 y `Firm (862)` devolvió 51 releases. El release 616233642 de Deere & Company / DZ133884 devolvió `Shipper_No=TJ12856`, `Rel_Qty=975`, `Shipped=792`, `Rel_Bal=183`. Los contenedores activos de la parte mostraron 277 Ready y 1306 WIP, distintos de Plex Demand para ese release (183 Ready, 0 WIP). El release 617871419 mostró Plex Demand Ready=475, WIP=462, Total Rel Due=1167, diferentes de la clasificación física.

La validación anterior se efectuó directamente contra un proxy local. Los cambios de Django y React de esta rama requieren ejecución de pruebas de integración y compilación en el entorno del proyecto antes de fusionar.

## Validación antes de merge

1. Desplegar primero el proxy de pruebas con el contrato de `POST /demand` (rama `feature/warehouse-demand-filters` de `plex-proxyO`), en un endpoint de prueba accesible a Django. No reemplazar el proxy de producción durante esta prueba.
2. Configurar `PLEX_PROXY_URL` y `PLEX_PROXY_SECRET` del backend de pruebas, sin almacenar secretos en Git.
3. Verificar Django `GET /warehouse/demand/?status=Open&ship_date_from=2026-10-01&ship_date_to=2026-10-31&release_types=Firm%20%28862%29`. Confirmar conteo y `Shipper_No`.
4. Comprobar combinaciones de Customer, PO, Customer Part No y varias Release Types. Las fechas incompletas, invertidas o de más de 180 días deben responder 400.
5. Ejecutar compilación de frontend y verificación de Django. Comprobar columnas, filtros, ausencia de duplicación y representación vacía de campos sin definir.
6. Registrar conciliación pendiente: `Qty_Ready`, `Qty_WIP`, `Total_Rel_Due` y `Requested_Ship_Date`.

No se ha hecho merge a `main`.
