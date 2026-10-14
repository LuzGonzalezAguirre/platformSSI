# Delivery Performance (OTD) — implementación provisional

## Datos

- Fuente: Plex Cloud, PCN 306713, mediante proxy HTTP y consultas ODBC de solo lectura.
- Vistas: Sales_v_Release, Sales_v_PO_Line, Sales_v_PO, Part_v_Part, Sales_v_Release_Status, Sales_v_Shipper_Line, Sales_v_Shipper.
- Unidad de programación: Release_Key. Cada cantidad programada se cuenta una sola vez por liberación, aunque existan varias líneas de embarque.
- Período: se selecciona por Due_Date y se obtiene el año en cuatro períodos trimestrales, cada uno menor a 180 días.
- Períodos de gráfica: mes calendario y semana ISO de Due_Date. Los porcentajes se calculan ponderados por Scheduled, no promediando porcentajes por liberación.
- Endpoint de proxy: POST /delivery-performance, start_date y end_date inclusive.
- API Django: GET /api/v1/warehouse/delivery-performance/?year=2026 con permiso warehouse.view.
- Frontend: /warehouse/delivery-performance.

## Cálculo provisional

Para cada línea de embarque:
- Early: fecha del embarque anterior a la fecha programada de la liberación.
- On Time: misma fecha calendario.
- Late: fecha posterior.
- OTD = (Early + On Time) / Scheduled * 100.

La clasificación utiliza una corrección experimental de -3 horas a la fecha de embarque leída del driver. **NO es una regla oficial de Plex**; solo se comprobó con un conjunto de ejemplos de octubre 2026. No alterar la hora del compromiso sin pruebas.

## Conciliación EDI

Se muestra `variance = Quantity_Shipped - SUM(Shipper_Line.Quantity)` por Release_Key. Las diferencias se señalan para revisión, no se atribuyen automáticamente a otras liberaciones.

Caso conocido: PO 5500146407, línea 19314177, `612627928` tiene -312 y `616826997` tiene +312. La suma se compensa, pero no existe una relación verificable entre el embarque TJ12837 y las 312 piezas del segundo registro. Las notas EDI 830 evidencian cambios de programación.

## Validaciones realizadas contra Plex

- Volvo 43306.3, Release_Key 567221633: 728 / 728 -> 100%.
- Deere 43422.3, Release_Key 616233642: 792 / 975 -> 81.23%.
- Cummins 43863.3, Release_Key 604888281: 12 / 51 -> 23.53%.
- Volvo 43301.3, Release_Key 594322409: requiere corrección de fecha al compararlo por día.
- Kautex 36460.3: divergencia entre Due_Date y Ship_Date; la definición oficial sigue pendiente.

## Pendiente antes de certificar KPI

1. Verificar validez del ajuste horario durante DST y comparar fechas con las que utiliza el reporte oficial.
2. Validar que estado de embarque 2249 representa los embarques computables; excluir anulaciones si aplica.
3. Resolver atribuciones EDI históricas y estados Open/Closed/obsolete con reporte Plex completo del mismo momento.
4. Confirmar nombres de clientes (se usa un mapa parcial de Customer_No) y tipo de producto.
5. Comparar agregados semanales y mensuales con el reporte oficial en una fecha de corte fija.
6. Ejecutar validación ODBC de producción y build de React; no realizadas mediante el conector de GitHub.
7. Evaluar rendimiento de cuatro consultas trimestrales y actualizar política de caché si aumenta el volumen.

No presentar los resultados de esta fase como indicador OTD certificado.
