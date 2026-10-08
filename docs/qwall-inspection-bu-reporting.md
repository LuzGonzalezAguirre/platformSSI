# BU de la inspección en el reporte Q-Wall

El reporte usa `COALESCE(ssi_Inspections.bu_id, ssi_PartNumbers.bu_id)` como BU efectiva. La BU explícita de cada inspección tiene prioridad sobre la del modelo. Una inspección histórica sin BU conserva la clasificación del catálogo; no se reclasifican registros en SQL automáticamente.

Esto permite que un mismo producto o QR tenga inspecciones de Cummins y TULC sin que el reporte las asigne todas a la BU del modelo. El número de parte mostrado sigue siendo el del producto. La regla se aplica a `/inspections`, `/piece-flags/count` y `/piece-flags` del proxy, y por tanto a los consumidores del reporte que usan esas consultas.

Report carga el selector de BUs desde el catálogo de unidades de negocio. La columna BU muestra el nombre obtenido de la BU efectiva. La descarga Excel envía las BUs seleccionadas al backend. El filtro Flag del detalle es local; no modifica el resumen ni el contenido del Excel.

## Requisito SQL

CCS debe tener `dbo.ssi_Inspections.bu_id INT NULL`, con valores válidos de `ssi_BusinessUnits`. Esa columna corresponde al cambio del cliente Q-Wall. Este PR no agrega columnas ni rellena históricos y no requiere migraciones Django. Desplegarlo antes de crear la columna provoca un error de columna inexistente en el proxy.

## Despliegue

Después de integrar el PR, actualizar la copia del repositorio en el servidor:

```powershell
git pull origin main
docker compose restart backend frontend
```

Reiniciar también el proceso Windows que ejecuta QWall Proxy en el puerto 8002. Si se ejecuta directamente con Uvicorn, detener el proceso anterior y volver a iniciarlo desde la carpeta del proxy:

```powershell
cd apps\qwall-proxy
python -m uvicorn main:app --host 0.0.0.0 --port 8002 --workers 1
```

Si el proxy está administrado por un servicio o tarea, reiniciar ese servicio o tarea en lugar de abrir un segundo proceso. Las variables de conexión y token permanecen iguales.

Las claves de caché de consultas y agregados cambian de versión para evitar reutilizar la clasificación anterior sin borrar otros datos de Redis.

## Validación

```powershell
python -m unittest discover -s apps/qwall-proxy/tests -p test_inspection_bu_reporting.py -v
cd apps/frontend
npm run build
```

Las seis pruebas usan SQLite en memoria y las funciones de consulta aisladas por AST; verifican BU explícita distinta de la del modelo, fallback para NULL, todas/múltiples BU y consistencia entre cantidad y detalle de flags. No usan CCS. La sentencia completa de inspecciones contiene funciones específicas de SQL Server; la prueba local ejecuta su expresión de BU y predicado extraídos, mientras que las consultas de flags se ejecutan completas adaptando el CAST de fecha. Queda pendiente probar la ejecución SQL Server en el servidor de la planta.
