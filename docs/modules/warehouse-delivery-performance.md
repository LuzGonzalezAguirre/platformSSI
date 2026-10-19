# Delivery Performance (OTD) — To Promise / Volume

## Contrato y origen de datos

- Plex Cloud PCN 306713, vía `plex-proxyO` (ODBC read-only).
- Endpoint proxy: `POST /delivery-performance`; `start_date` y `end_date` inclusivas, máximo 180 días.
- API Django: `GET /api/v1/warehouse/delivery-performance/?year=2026`.
- UI: `/warehouse/delivery-performance`.
- La selección del periodo usa **Sales_v_Release.Ship_Date** (promesa), **no Due_Date**.
- Solo se incluyen liberaciones con `Quantity_Shipped > 0` y `Scheduled > 0`.
- El backend consulta cuatro trimestres; cada consulta amplía una ventana auxiliar (62 días antes y 93 después) para conciliar liberaciones EDI cercanas.

## OTD

Para cada `Release_Key`: `100 * (Early + On_Time) / Scheduled`.

Para cualquier conjunto de liberaciones (mes, cliente, semana, año):
`OTD = AVG(OTD_por_liberacion_sin_redondear)`.

El total **no** se obtiene con `(SUM(Early)+SUM(On_Time))/SUM(Scheduled)`.
Los totales de Early/On Time/Late sí se suman normalmente.

La agrupación mensual y semanal usa `Ship_Date` prometida; la fecha `Due_Date` se muestra como información.

## Conciliación de embarques

1. Se calculan los saldos `Quantity_Shipped-SUM(Shipper_Line.Quantity)` por liberación.
2. Se distribuyen las líneas de embarque en orden cronológico, hasta completar `Quantity_Shipped` de origen.
3. Los excedentes se atribuyen a otra liberación de la misma `PO_Line_Key` solo si los saldos opuestos coinciden exactamente y el emparejamiento es único en ambas direcciones.
4. Los excedentes sin coincidencia inequívoca no se atribuyen.
5. `Unattributed_Quantity` representa `Quantity_Shipped-(Early+On_Time+Late)`, pero no se presupone que sea Late.

## Fechas y limitaciones

- La normalización horaria es provisional: se interpreta el timestamp ODBC de embarque como UTC y se convierte al calendario del Pacífico.
- Actualmente se usan los límites concretos de horario de verano de **2026**: 8 marzo 10:00 UTC y 1 noviembre 09:00 UTC. Para otros años se necesita una función horaria general.
- El método de distribución cronológica y la correspondencia EDI por saldo exacto se han validado sobre muestras, no constituyen una regla documentada por Plex.
- Casos con distribución EDI parcial o varias parejas candidatas pueden requerir más investigación.
- `reconciled` indica únicamente si el valor `Unattributed_Quantity` es cero; no certifica todas las reasignaciones.
- Un resultado en un mes concreto no garantiza identidad absoluta de las cantidades para todos los periodos.

## Comparativas disponibles contra Plex (2026)

| Mes | Plex OTD | SQL OTD | Observación |
| --- | ---: | ---: | --- |
| Enero | 53.33% | 53.33% | Late difiere en 182 piezas por detalle EDI |
| Febrero | 93.44% | 93.44% | Totales coinciden |
| Marzo | 87.23% | 87.23% | Totales coinciden; cruza cambio DST |
| Abril | 98.72% | Pendiente | |
| Mayo | 82.93% | Pendiente | |
| Septiembre | 79.26% | 79.26% | Totales y 83 liberaciones coinciden |

Los datos anteriores provienen de ejecuciones SQL de diagnóstico suministradas en la conversación; el despliegue integrado debe comprobarse nuevamente.

## Verificaciones antes de desplegar

1. Ejecutar query ODBC con permisos reales en proxy y verificar que las cuatro consultas trimestrales terminan en tiempo razonable.
2. Comprobar OTD agrupado por cliente y mes contra Plex; asegurar que el promedio no use porcentajes previamente redondeados.
3. Auditar distribución EDI parcial, emparejamientos ambiguos y embarques sin origen trazable.
4. Revisar timestamps cercanos a medianoche y cambio DST; generalizar a años distintos de 2026.
5. Probar endpoint Django, frontend y la estrategia de caché de 300 segundos.
6. Evaluar si el KPI puede etiquetarse como certificado; hasta entonces conservar el aviso de validación pendiente.
