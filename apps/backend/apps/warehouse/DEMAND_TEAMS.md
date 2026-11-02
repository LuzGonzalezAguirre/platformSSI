# Demand: nuevos releases de Plex a Microsoft Teams

## Arquitectura

La integración se ejecuta en platformSSI. Celery Beat consulta cada 15 minutos el
endpoint /demand de plex-proxyO para todas las liberaciones cuyo Ship_Date está
dentro del mes actual. El proxy debe devolver Release_Key sin excluir clientes.

Django guarda la primera consulta mensual como línea base sin notificaciones,
mediante warehouse_demand_alert_sync_state. Las liberaciones nuevas se insertan
una sola vez por Release_Key en warehouse_demand_release_alert (clave única).

Otro worker de Celery intenta entregar pendientes cada 5 minutos, con máximo
cinco intentos. Los errores quedan en last_error y no bloquean Demand. Teams
puede recibir duplicados si el HTTP de Power Automate se acepta pero vence el
timeout antes de obtener respuesta: la entrega es *at least once*.

## Power Automate

Usar el trigger When a Teams webhook request is received. La acción Post card
in a chat or channel debe usar el siguiente valor como expresión de tarjeta:

    triggerBody()?['attachments']?[0]?['content']

Configurar chat/canal específico de Warehouse directamente en el Flow.
El JSON sigue el mismo contrato de attachments de ActionTracker.

## Configuración y despliegue

Agregar al archivo .env local (nunca versionarlo):

    DEMAND_TEAMS_WEBHOOK_URL=https://<URL de Workflows>

docker-compose.yml pasa esa variable a backend, celery_worker y celery_beat.

Después de actualizar ambos repositorios:

    docker compose up -d --build backend celery_worker celery_beat
    docker compose exec backend python manage.py migrate
    docker compose exec backend python manage.py check

Revisar los logs de celery_worker y celery_beat. La primera sincronización no
envía los releases ya existentes. Para ver los registros en Django shell:

    from apps.warehouse.models import DemandReleaseAlert, DemandAlertSyncState
    print(DemandAlertSyncState.objects.count(), DemandReleaseAlert.objects.count())

El sistema no modifica releases de Plex. Para probar el Flow sin crear
falsos registros en la cola, invocarlo manualmente con un payload de prueba.

## Limitaciones

- La detección usa la fecha de embarque (Ship_Date) en el mes en curso, no la
  fecha de creación en Plex. Si una liberación creada hoy tiene embarque fuera
  del mes actual, no generará esta alerta.
- Los cambios a un Release_Key conocido no generan notificaciones nuevas.
- El envío depende de la conexión de platformSSI al plex-proxyO actualizado.
- La URL de Power Automate es un secreto y nunca debe registrarse en logs.


## Seguimiento de cambios y cierres (opt-in, PR independiente)

El monitor adicional en `release_change_tasks.py` **no sustituye** la cola original
de avisos por releases nuevos. Consulta `/demand` con `release_status="All"`
(incluidos `Closed` y `Shipped`) cada 15 minutos, con ventana móvil de
60 días hacia atrás y 90 días hacia delante sobre `Ship_Date`. Guarda el
último estado observado por `Release_Key` en
`warehouse_demand_release_snapshot`.

**Primera observación silenciosa por Release_Key**: nunca genera avisos de
cierres históricos. Las consultas posteriores detectan las transiciones:
- `Open → Closed`: `RELEASE_CLOSED`.
- `Closed → Open`: `RELEASE_REOPENED`.
- Otros cambios de `Rel_Status`: `STATUS_CHANGED` (incluido `Shipped`).
- Cambios en `Rel_Qty`: `QUANTITY_CHANGED`.
- Cambios de `Ship_Date`: `SHIP_DATE_CHANGED`.

Si varios campos cambian en el mismo sondeo se genera **una tarjeta** con todas
las diferencias anteriores/nuevas. No interpretamos un saldo o cantidad cero
como cierre. No hacemos alertas por desaparición del release del resultado
(que podría corresponder a un cambio de ventana o fallo del proxy). La tabla
`warehouse_demand_release_change_alert` contiene la cola, reintentos y
resultado de entrega. Un release puede tener varios eventos, a diferencia
de `warehouse_demand_release_alert`, que es única por Release_Key.

En el `.env` agregar **solo cuando se haya validado el despliegue**:

    DEMAND_CHANGE_ALERTS_ENABLED=true

Por defecto es `false`. Se pasa a backend, celery_worker y celery_beat.
Mantener `DEMAND_TEAMS_WEBHOOK_URL` configurado para el mismo flujo de Teams.

Despliegue y pruebas:

    docker compose up -d --build backend celery_worker celery_beat
    docker compose exec backend python manage.py migrate
    docker compose exec backend python manage.py check
    docker compose exec backend python manage.py test apps.warehouse.test_release_change_alerts

Para prueba controlada antes de habilitar la programación automática:
1. Dejar `DEMAND_CHANGE_ALERTS_ENABLED=false` y ejecutar migraciones y tests.
2. Dejar `DEMAND_CHANGE_ALERTS_ENABLED=false` en todos los servicios.
3. Ejecutar **una sola vez** desde Django shell, activando únicamente la
   llamada de monitoreo de forma temporal (sin habilitar el worker):
   
       from django.test.utils import override_settings
       from apps.warehouse.release_change_tasks import monitor_demand_release_changes
       with override_settings(DEMAND_CHANGE_ALERTS_ENABLED=True):
           print(monitor_demand_release_changes())

   Esperado: `seeded > 0, changed = 0` si no existían snapshots.
4. Inspeccionar snapshots y cola de cambios: el envío sigue desactivado en
   Celery porque el archivo .env permanece en `false`.
5. Cuando sea aprobado, cambiar el flag a `true`, recrear servicios y
   confirmar las primeras alertas.

Limitaciones: sistema de *polling*, no historial completo EDI. Eventos que
ocurren entre dos sondeos y se revierten pueden pasar desapercibidos; cambios
repetidos con el mismo par de estados anterior/nuevo están deduplicados;
un cambio fuera de la ventana de Ship_Date no se observa. Un HTTP aceptado
seguido de timeout puede producir duplicados de Teams.
