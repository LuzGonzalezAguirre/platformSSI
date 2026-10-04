# Background Processing and Scheduled Work

## 1. Runtime

PlatformSSI uses Celery 5.4 for asynchronous processing.

Redis is the configured Celery broker.

Task results are stored using django-celery-results.

Celery Beat uses django-celery-beat with DatabaseScheduler.

The worker process is started with concurrency 4 in the current Docker development composition.

## 2. Global task behavior

Task tracking is enabled.

The global Celery task time limit is 30 minutes.

The scheduler timezone is America/Monterrey.

## 3. Scheduled recurring tasks

The base settings define two recurring Saturday jobs.

| Task | Schedule |
|---|---|
| apps.quality.cogp.tasks.stage_weekly_cogp_offenders | Saturday 07:00 |
| apps.maintenance.tasks.stage_weekly_maintenance_offenders_task | Saturday 07:15 |

## 4. COGP tasks

### 4.1 sync_cogp_daily

sync_cogp_daily is a bound shared task.

The task supports automatic retries with a maximum of three retries and a default retry delay of 300 seconds.

Its responsibility is daily COGP synchronization.

### 4.2 backfill_cogp_range

backfill_cogp_range performs range backfill behavior.

The implementation schedules daily processing separately to avoid saturating the Plex proxy with one large operation.

### 4.3 warm_scrap_rate_cache

warm_scrap_rate_cache precalculates scrap-rate cache values.

The task is a bound shared task with one retry and a 300 second default retry delay.

The task exists specifically to prevent the first interactive user from paying the full cold-cache Plex query cost.

### 4.4 stage_weekly_cogp_offenders

stage_weekly_cogp_offenders is a bound shared task with two retries and a 600 second default retry delay.

It stages weekly offender actions after calculating the target workweek and offender set.

## 5. Maintenance tasks

stage_weekly_maintenance_offenders_task is a bound shared task.

The task allows two retries with a default retry delay of 600 seconds.

It is scheduled shortly after the weekly COGP offender task.

## 6. Incoming Inspection tasks

Quality tasks include snapshot synchronization, history synchronization, a combined incoming-inspection refresh operation and downtime-workcenter synchronization.

The incoming refresh task uses a cache-based lock to coordinate refresh execution.

Synchronization status is persisted in IncomingInspectionSyncState.

The refresh task removes the lock only when the stored lock value still matches the current task identifier.

## 7. Transaction handling

Incoming Inspection synchronization uses transaction.atomic in at least one snapshot update path.

This ensures grouped PostgreSQL updates are committed atomically for that operation.

## 8. Retry architecture

Retry behavior is currently task-specific.

Some bound tasks define Celery max_retries and default_retry_delay.

Other tasks have no explicit retry policy at the decorator level.

The platform therefore has background retry capability but no single cross-module retry policy.

## 9. Task observability

Celery task tracking is enabled and task results are persisted.

The reviewed settings do not establish a dedicated task telemetry dashboard, centralized structured task logging or queue-depth metric export.

Those capabilities should be treated as future observability work rather than current functionality.
