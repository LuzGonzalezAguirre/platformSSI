# Q-Wall: configuración de inspección por lote

El tab **Inspección por lote** guarda el tamaño general de cada BU de forma independiente (por ejemplo Eaton 120 y CPS 90) o uno por cada modelo del BU. CCS sólo se consulta para validar BU y modelos. Las tres tablas nuevas viven en **PostgreSQL de platformSSI**, no en CCS/SQL Server.

La matriz se transcribió de GL-QA 02 Rev. 00. Una celda `*` significa inspeccionar el lote completo. La nueva foto deja leer completa la fila **151–280**. El documento aún deja sin rango **500,001–500,999**. Esas cantidades no calculan muestras ni se pueden guardar como tamaño configurado hasta contrastarlas con un original legible. La pantalla resalta la intersección del lote y el índice (120 con 2.5 = 11).

## Instalación recomendada (Django crea y llena las tablas)

```bash
git pull origin main
docker compose exec backend python manage.py showmigrations quality
docker compose exec backend python manage.py migrate
# Si el frontend se sirve desde un build de Docker:
docker compose up -d --build backend frontend
```

El comando `migrate` aplica `quality.0008_qwall_lot_sampling` y los demás cambios pendientes. Reiniciar el backend y publicar el frontend es necesario para servir los endpoints y el tab nuevo. Ajusta los nombres de servicios si tu compose de producción los cambia.

## Instalación manual por SQL (alternativa)

Ejecuta [`sql/qwall_lot_sampling_postgres.sql`](sql/qwall_lot_sampling_postgres.sql) **una sola vez en PostgreSQL de platformSSI**, después de tener aplicada `quality.0007_cogpsettings`. Este script crea y llena las tres tablas y registra `0008` en `django_migrations` en la misma transacción. No ejecutes además la migración `0008` para crear esas mismas tablas: al estar registrada, Django la omite. Luego ejecuta `python manage.py migrate` normalmente para otras migraciones pendientes.

Este cambio prepara el setup y la consulta de muestras. La apertura automática de una inspección al completar un lote y el escaneo del inspector requieren definir el identificador y el inicio/cierre real de cada lote; todavía no se conectan con el flujo de producción.
