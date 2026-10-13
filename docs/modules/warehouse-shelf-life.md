# WH Shelf Life — Plex proxy contract

## Estado de integración

La rama implementa frontend React y `GET /api/v1/warehouse/shelf-life/` en Django.
El código fuente del proxy ODBC de Plex está en el repositorio independiente `LuzGonzalezAguirre/plex-proxyO`.
La ruta `POST /shelf-life` se agregó en `plex-proxyO` mediante PR #11. Se debe actualizar el proxy instalado localmente y verificar la consulta real antes de utilizar el dashboard en producción. Ante fallos de conexión Django devolverá 502 y el frontend mostrará el error, sin datos ficticios.

## Contrato

Petición autenticada: `POST /shelf-life`, JSON `{}`, el mismo bearer token y estructura que `POST /demand`.
Respuesta: `{"data":[{"Serial_No":"P959523","Part_Key":3498687,"Location":"TJR5-01","Quantity":45,"Container_Status":"OK","Shelf_Date":"2026-04-20","Expired_Date":"2026-10-20"}]}`.

Deben emitirse fechas ISO 8601, preferentemente `YYYY-MM-DD`; no enviar fechas con textos localizados. La consulta es *read-only* y regresa únicamente el inventario vivo de PCN 306713 con localidades TJR y configuración Shelf Life. No filtrar por `Shelf_Date` reciente: hay productos vigentes con fecha de origen anterior al límite habitual de 180 días. Cualquier política de ventana del proxy deberá revisarse por separado.

## SQL validado mediante el editor Plex

Todos los objetos cuentan con alias. No utiliza CTE ni tablas temporales. La subconsulta derivada puede omitirse porque Django clasifica los estados.

```sql
SELECT
    c.Serial_No,
    c.Part_Key,
    c.Quantity,
    c.Location,
    c.Container_Status,
    c.Shelf_Date,
    CASE
        WHEN psl.Unit = 'Month(s)' THEN DATEADD(month, psl.Shelf_Life, c.Shelf_Date)
        WHEN psl.Unit = 'Day(s)' THEN DATEADD(day, psl.Shelf_Life, c.Shelf_Date)
        WHEN psl.Unit = 'Year(s)' THEN DATEADD(year, psl.Shelf_Life, c.Shelf_Date)
        ELSE NULL
    END AS Expired_Date
FROM Part_v_Container AS c
INNER JOIN Part_v_Part_Shelf_Life AS psl
    ON c.Part_Key = psl.Part_Key
    AND c.Plexus_Customer_No = psl.PCN
WHERE
    c.Plexus_Customer_No = 306713
    AND c.Active = 1
    AND c.Quantity > 0
    AND c.Location LIKE 'TJR%'
    AND c.Shelf_Date IS NOT NULL
```

La consulta devuelve registros a nivel contenedor, sin `TOP`, para evitar subestimar el denominador. El endpoint debe manejar paginación o resultados extensos sin descartar filas silenciosamente. Verificar si existe un límite ODBC del proxy y no truncar a los primeros 100 registros.

## Implementación sugerida en el plex-proxy existente

En el proxy real, reutilizar el método `get_conn()`/autenticación y serializador JSON existentes; los nombres exactos dependen de ese proyecto. El controlador ejecutará exclusivamente el SQL anterior, convertirá campos `date/datetime` con `isoformat()`, `Decimal` a `float` y responderá `{"data": rows}`. Proteger `POST /shelf-life` con el mismo sistema bearer que el resto del proxy. No interpolar texto recibido del cliente en SQL.

## Cálculos Django

El endpoint `/api/v1/warehouse/shelf-life/?as_of=2026-10-13&horizon=30` clasifica cada contenedor: vencido (fecha anterior al día), próximo a vencer (0..N días, inclusivo), vigente, o fecha desconocida. Devuelve resumen, porcentajes por contenedores, análisis por `Part_Key`, ubicación y listado completo. Mantiene `Container_Status` separado de caducidad: `Hold` no implica necesariamente vencimiento.

La fecha de referencia se interpreta por día y no por segundo. La vista solo consulta ubicaciones TJR; la cobertura del filtro de Excel original debe validarse en planta. El porcentaje principal compara número de contenedores, no costo ni cantidades mezcladas entre unidades.

## Seguridad y mantenimiento

Los permisos de consulta siguen el módulo `warehouse`, la lectura ODBC se realiza en `plex-proxy` y Django cachea el resultado 300 segundos. El dashboard no admite escritura de inventario. Se debe revisar el límite de filas, timeouts, fechas nulas, partidas con configuraciones múltiples y validez de `Unit` en operación. El informe no dispone todavía de tendencias históricas reales, costo ni nombre de parte.

## Validación

1. Probar que el proxy devuelve el contenedor P959523 con vencimiento 2026-10-20.
2. Comparar conteos al 2026-10-13: 87 total, 0 caducados, 1 próximo en 30 días, 86 OK, 0 desconocidos para el conjunto TJR observado.
3. Cambiar fecha de referencia para verificar transición a Expired.
4. Probar API Django autenticada, permisos, ausencia de caché obsoleta y accesibilidad del frontend.
5. Ejecutar `npm run build` y pruebas del backend antes de realizar despliegue.
