# Q-Wall: configuración de inspección por lote

La configuración **General por BU** permite, por ejemplo, Eaton = 120 y CPS = 90 para todos los modelos respectivos. **Por modelo** guarda un tamaño individual para cada PN. La configuración, las elecciones guardadas y la matriz GL-QA 02 Rev. 00 están en **CCS / SQL Server** (`dbo.ssi_QWallLotSettings`, `dbo.ssi_QWallLotModelSettings`, `dbo.ssi_QWallSamplingMatrix`). El backend Django verifica los roles y envía las peticiones al `qwall-proxy`; no escribe estas elecciones en PostgreSQL.

## Instalación en el servidor

1. `git pull origin main` en platformSSI.
2. Ejecuta [`../scripts/sql/ssi_QWallLotSampling.sql`](../scripts/sql/ssi_QWallLotSampling.sql) en **CCS**, por ejemplo con SSMS. El script es repetible y conserva las elecciones existentes. **No** lo ejecutes en PostgreSQL.
3. Ejecuta `docker compose exec backend python manage.py migrate`. La migración `quality.0009` retira las tablas PostgreSQL que había agregado el cambio anterior. En instalaciones nuevas, `0008` crea esas tablas y `0009` las elimina; el estado final no incluye tablas de lotes en PostgreSQL. Si alguien llegó a guardar elecciones allí, `0009` se detiene para que se copien a CCS antes de eliminarlas.
4. Reinicia backend, qwall-proxy y frontend después de actualizar el código. El proxy corre en Windows por separado; reinicia su proceso `start_qwall_proxy.bat` o el servicio que lo aloja.

En la pantalla, 120 piezas con índice 2.5 corresponden a 11 inspecciones y 200 con índice 2.5 a 13. El original deja sin rango 500,001–500,999; esas cantidades no se pueden configurar hasta verificar el criterio correcto.

Este cambio entrega el setup y la consulta de muestras. La apertura automática de una inspección al completar un lote requiere definir el identificador y el inicio/cierre real de cada lote; todavía no se conecta con el flujo de producción.
