# COGP and Scrap Analytics

## 1. Scope

The COGP subdomain calculates cost-of-poor-quality and scrap indicators from Plex data, maintains selected synchronized records in PostgreSQL, provides live analytical views, caches expensive time ranges and stages weekly scrap-offender actions.

## 2. Persistent entities

COGP owns COGPDailySummary, CogpSettings, CustomerPartMapping, ProductionRecord and ScrapRecord.

CogpSettings contains cost and piece target percentages.

CustomerPartMapping assigns source parts to customer and business-unit context.

ProductionRecord and ScrapRecord store synchronized source data when the synchronization path is used.

COGPDailySummary stores calculated daily business-unit results.

## 3. Plex client operations

QualityPlexClient provides COGP-specific proxy operations for cost model retrieval, customer-part mapping, scrap by date, production by date, scrap by range, production by range and production quantity by range.

All source retrieval flows through the Plex proxy.

## 4. Synchronization service

PlexSyncService resolves cost model, synchronizes customer-part mapping, synchronizes scrap, synchronizes production and can synchronize all required data for one report date.

The synchronization path is separate from live-report paths that query Plex directly.

## 5. Daily business-unit calculation

CogpDailyBuService calculates daily buckets directly from Plex source data.

The service classifies scrap and production into business units and caches each day independently.

Closed-day TTL is 7 days.

Open-day TTL is 10 minutes.

Cache keys are versioned with v2 in the reviewed implementation.

The service guards against caching an apparently valid zero result when Plex returned rows that could not be classified.

## 6. Scrap Rate

ScrapRateService calculates weekly scrap rate from Plex data.

The service generates an ISO-week spine and stores weekly cache buckets.

Closed weeks use a 7-day TTL.

The current week uses a 10-minute TTL.

The reviewed cache version is v5.

## 7. Scrap Rate stampede protection

ScrapRateService implements range-level locking with cache.add.

Lock lifetime is 60 seconds.

Waiting requests sleep for 0.5 seconds and retry cache retrieval three times.

If the lock remains unavailable after retries, a request may calculate independently.

This is the current repository's explicit cache-stampede protection implementation.

## 8. Pareto analysis

CogpParetoService retrieves source data in date windows, resolves business-unit classification and builds Pareto buckets.

The service also associates open action references with reason and workcenter combinations.

## 9. Live trend

CogpLiveTrendService calculates weekly COGP trend directly from Plex through the proxy.

This path should be distinguished from persisted daily summaries and synchronized source records.

## 10. Weekly offender staging

scrap_action_service identifies the last completed workweek, creates deterministic source keys and stages offender payloads through the Q-Wall proxy.

The Q-Wall proxy writes to dbo.ssi_ScrapOffenderActions using locking semantics that prevent duplicate staging by SourceKey.

The Celery task stage_weekly_cogp_offenders is scheduled for Saturday at 07:00.

The task permits two retries with a 600-second delay.

## 11. Cache warming

warm_scrap_rate_cache precalculates historical weekly scrap-rate buckets.

The task exists to remove the cold-query cost from the first interactive user request.

## 12. COGP API

The API provides settings, scrap-integration test, current offenders, summary, weekly trend, mapping catalog, Pareto and scrap-rate endpoints.

## 13. Frontend routes

| Route | Function |
|---|---|
| /quality/cogp | COGP dashboard |
| /quality/cogp/mapping | Part and business-unit mapping |
| /quality/scrap-rate | Scrap-rate view |

## 14. Data-source characteristic

COGP contains both synchronized and live calculation paths.

Any downstream consumer must distinguish between PostgreSQL snapshots and values calculated directly from Plex at request time.
