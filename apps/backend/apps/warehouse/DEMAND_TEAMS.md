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
