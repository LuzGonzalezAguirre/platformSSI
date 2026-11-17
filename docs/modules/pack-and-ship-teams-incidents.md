# Pack and Ship Volvo: alertas de incidencias a Microsoft Teams

## Estado
Integración **opt-in**, deshabilitada por defecto. No se han enviado
notificaciones ni se ha alterado ninguna tabla de CCS.

## Origen del evento
- Fuente: `CCS.dbo.ssi_PaS_ScanRejectionEvents`.
- Clave de deduplicación: `event_id` (un evento por tarjeta). No usar
  `rejection_id`: una incidencia bloqueante puede producir varios eventos.
- Incluye todos los tipos de rechazo registrados en el log, no solo duplicados.
- La API del qwall-proxy lee por `event_id > cursor`, en orden ascendente y
  por lotes. No depende del periodo del dashboard.
- Los eventos anteriores al primer sondeo se toman como **línea base sin
  notificación**; no se envían alertas históricas.
- La tabla `production_pack_ship_incident_cursor` conserva el último evento
  encolado; `production_pack_ship_incident_alert` guarda payload, intentos
  y estado. Ambas tablas están en **PostgreSQL**, NO en CCS.

## Flujo técnico
1. Celery Beat ejecuta `monitor_pack_ship_incidents` cada 2 minutos.
2. Django lee `GET /pack-and-ship/incidents/alert-head` solo si no existe
   cursor inicial; el primer sondeo no crea alertas.
3. En siguientes sondeos consulta `GET /pack-and-ship/incidents/alert-feed`
   con `after_event_id` y `limit` (hasta 500; el worker usa 250).
   Primero persiste la alerta y luego avanza el cursor dentro de la misma
   transacción.
4. Celery Beat ejecuta `send_pack_ship_incident_alerts` cada 2 minutos,
   máximo 25 mensajes pendientes por ciclo, cinco intentos.
5. La entrega es *at least once*: un timeout después de aceptación del Flow
   podría duplicar una tarjeta. Un `event_id` nunca crea dos filas de outbox.

**No envía automáticamente mensajes de resolución o aprobación.** El estado
en la tarjeta es el que tenía el rechazo al momento en que se consultó.

## Power Automate / Teams
Crear un **Workflow separado de Demand**, usando el desencadenador
`When a Teams webhook request is received` y una acción
`Post card in a chat or channel` en el canal elegido por Producción/Calidad.

Usar como contenido de la tarjeta:

    triggerBody()?['attachments']?[0]?['content']

El payload conserva el contrato de ActionTracker y Demand
(`attachments[].contentType = application/vnd.microsoft.card.adaptive`).

El webhook debe permanecer secreto. Se guarda **únicamente** en `.env`
y nunca en el repositorio, consola ni documentación pública.

## Variables en .env
```dotenv
PACK_SHIP_TEAMS_ALERTS_ENABLED=false
PACK_SHIP_TEAMS_WEBHOOK_URL=
```

Estas variables se propagan a backend, celery_worker y celery_beat.
La URL de Demand `DEMAND_TEAMS_WEBHOOK_URL` no se reutiliza.

## Despliegue y validación (sin enviar mensajes)
```powershell
git fetch origin
git switch feature/pack-and-ship-teams-incidents
docker compose up -d --build backend celery_worker celery_beat
docker compose exec backend python manage.py migrate
docker compose exec backend python manage.py check
docker compose exec backend python manage.py test apps.production.test_pack_ship_teams_alerts
```

Verificar que el Q-Wall Proxy de puerto 8002 se actualizó y reinició. Sus
endpoints nuevos requieren `Authorization: Bearer QWALL_PROXY_TOKEN`.

**Sembrar la línea base sin configurar el webhook** (con worker deshabilitado):
```powershell
docker compose exec backend python manage.py shell -c "from django.test.utils import override_settings; from apps.production.tasks import monitor_pack_ship_incidents; scope=override_settings(PACK_SHIP_TEAMS_ALERTS_ENABLED=True); scope.enable(); print(monitor_pack_ship_incidents()); scope.disable()"
```

Debe devolver `{'status': 'seeded', 'queued': 0, ...}` si el cursor no existía.
Inspeccionar la cola:
```powershell
docker compose exec backend python manage.py shell -c "from apps.production.models import PackShipIncidentCursor,PackShipIncidentAlert; print(list(PackShipIncidentCursor.objects.values())); print(list(PackShipIncidentAlert.objects.values('event_id','status','attempts')))"
```

Solo después de aprobar la configuración del Flow: asignar la URL HTTPS
y cambiar `PACK_SHIP_TEAMS_ALERTS_ENABLED=true` en `.env`, recrear los
servicios con `docker compose up -d --force-recreate backend celery_worker celery_beat`.
Probar con **una incidencia controlada nueva**, no con eventos históricos.

Para pausar sin perder los registros:
`PACK_SHIP_TEAMS_ALERTS_ENABLED=false` y recrear los servicios.

## Límites / seguridad
- No usa triggers ni realiza INSERT/UPDATE/DELETE en CCS.
- Los cambios a una aprobación ya registrada no generan una segunda alerta.
- La tarjeta contiene seriales SSI y cliente: revisar que el canal tenga
  audiencia apropiada antes de activar el webhook.
- Si el webhook acepta la petición y el cliente vence por timeout, un retry
  puede duplicar el mensaje en Teams. La deduplicación es fiable en la cola,
  pero no garantiza exactamente una entrega externa.
- Se permiten hasta 2,000 eventos por ciclo de sondeo (8 lotes de 250); los
  pendientes se continúan leyendo en ciclos siguientes.
- Si se restaura CCS desde un respaldo que reinicie los `event_id`, será
  necesario revisar manualmente el cursor antes de reactivar el monitor.

## Formato de tarjeta (noviembre 2026)
- Encabezado: `PACK AND SHIP VOLVO` (sin Production), estilo Adaptive Card
  `accent`. El cliente Teams controla el color final según su tema: no se
  puede imponer un hexadecimal morado arbitrario usando `Container.style`.
- `event_id` permanece en la metadata de deduplicación y **no** es visible
  entre los hechos de la tarjeta.
- `Pallet` pasa a `No. de Lote`.
- `detected_at` proveniente de CCS se interpreta como UTC y se presenta en
  `America/Tijuana` (ejemplo: 2026-11-17 19:57:27 UTC =
  2026-11-17 11:57:27 AM Tijuana). Se informa la hora de detección, **no** la
  hora de envío de Teams.
- El payload admite `approval_departments` cuando el backend lo reciba de
  una fuente CCS validada. **Todavía no existe lectura de departamentos activos
  en el feed**, por lo que muestra un marcador explicativo para no anunciar
  aprobaciones inexistentes. Antes de activar en producción, conectar este campo
  a la configuración real y validar qué departamentos están activos.

### Descubrir tipos y configuración de aprobación en CCS (solo lectura)

```sql
SELECT rejection_type, COUNT(*) AS total
FROM dbo.ssi_PaS_ScanRejectionEvents
GROUP BY rejection_type
ORDER BY total DESC;

SELECT TABLE_SCHEMA, TABLE_NAME, COLUMN_NAME, DATA_TYPE
FROM INFORMATION_SCHEMA.COLUMNS
WHERE TABLE_NAME LIKE '%PaS%'
  AND (
    COLUMN_NAME LIKE '%approv%'
    OR COLUMN_NAME LIKE '%department%'
    OR COLUMN_NAME LIKE '%role%'
    OR COLUMN_NAME LIKE '%active%'
  )
ORDER BY TABLE_NAME, ORDINAL_POSITION;
```

Los `rejection_type` almacenados son la fuente de verdad; las etiquetas
`DUPLICATE_SAME`, `DUPLICATE_OTHER` y `QWALL_REJECT` existen en
las traducciones de la UI, pero no constituyen un catálogo exhaustivo.
