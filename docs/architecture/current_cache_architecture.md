# Current Cache Architecture

## 1. Purpose

This document records cache behavior currently implemented in PlatformSSI. It is an AS IS description and does not define the future cache architecture.

Redis is configured as the Django cache backend in the development environment. The same Redis service is also used as the Celery broker.

## 2. Global configuration

The development cache backend is django_redis.cache.RedisCache.

The development key prefix is mes_dev.

The base settings define PLEX_CACHE_TTL as 300 seconds, although individual services also define their own cache durations.

The Docker Redis service is configured with a maximum memory of 512 MB and allkeys-lru eviction.

## 3. Q-Wall repository cache

QWallRepository caches data retrieved from the Q-Wall proxy.

The repository TTL is 300 seconds.

Confirmed cache families include inspection data, piece-flag counts, piece-flag rows, business units, part numbers and inspection-point failures.

Keys include source-specific prefixes and, where appropriate, date ranges and business-unit fragments.

Representative key structures include qwall:raw, qwall:flags, qwall:piece_flags, qwall:business_units, qwall:part_numbers and qwall:point_fails.

Proxy requests in this repository layer currently use a timeout of 120 seconds.

## 4. Q-Wall service cache

QWallService applies an additional aggregation cache above QWallRepository.

The service TTL is 300 seconds.

Cached derived responses include primary Q-Wall aggregation, business-unit summaries, part-number summaries, fail-by-point results, Pareto data, trend data and pass-rate target values.

The current design therefore contains multiple cache layers inside the application even though both layers use the same configured Django cache backend.

## 5. COGP Scrap Rate cache

ScrapRateService contains the most advanced cache policy currently implemented in the repository.

Closed weeks use a TTL of 604800 seconds, equivalent to 7 days.

The current week uses a TTL of 600 seconds, equivalent to 10 minutes.

Cache keys are explicitly versioned. The reviewed implementation uses cache version v5.

The service uses cache.get_many and cache.set_many for weekly buckets.

The service also implements a cache lock with cache.add to reduce cache stampede when multiple requests simultaneously need the same missing Plex range.

The lock TTL is 60 seconds.

The service waits 0.5 seconds between lock checks and performs three lock-read retries before allowing a fallback calculation.

This is an existing single-flight-like protection mechanism and should be preserved or generalized during future cache refactoring.

## 6. COGP daily cache

COGPDailyBuService caches values by day.

Closed days use a TTL of 604800 seconds.

Open days use a TTL of 600 seconds.

The reviewed implementation uses cache version v2 and bulk cache operations.

The service intentionally avoids caching an invalid zero result when Plex returned rows that could not be classified into expected buckets.

## 7. Maintenance cache

MaintenanceService uses a default cache TTL of 600 seconds for several dashboard calculations.

Some individual calculations use 300 seconds.

At least one result path uses a 3600 second TTL.

Keys are built from maintenance filter context and versioned prefixes such as maint:kpis:v2.

## 8. Work Requests cache

WorkRequestsService uses a 300 second cache TTL.

The service explicitly attaches live Action Tracker links after reading the cached Plex result so that Action Tracker state is not frozen inside the five-minute Plex cache.

This is a deliberate separation between relatively stable source data and live action state.

## 9. Down Equipment cache

DownEquipmentService uses two distinct TTLs.

Current state uses 30 seconds.

Historical data uses 600 seconds.

This is consistent with the different volatility of live equipment state and historical event data.

## 10. OPS report cache

OpsReportService uses a default cache TTL of 600 seconds.

The implementation contains cache keys for daily or weekly operational report calculations, including versioned keys such as ops:table:v2.

## 11. Incoming Inspection refresh lock

Incoming Inspection background refresh logic uses the Django cache as a task lock.

The refresh task validates ownership of the lock by task identifier before deleting it.

This use of Redis is coordination behavior rather than response caching.

## 12. Cache policy characteristics

The current repository already contains several useful cache-policy concepts.

| Concept | Current implementation |
|---|---|
| TTL | Implemented in multiple services |
| Volatility-specific TTL | Implemented in COGP and Down Equipment |
| Key versioning | Implemented in selected services |
| Bulk get and set | Implemented in COGP |
| Cache warming | Implemented for Scrap Rate |
| Stampede protection | Implemented specifically in Scrap Rate |
| Task coordination lock | Implemented for Incoming Inspection |
| Shared namespace standard | Not centralized |
| Central cache metrics | Not identified |
| Stale-while-revalidate | Not identified as generalized behavior |
| Unified invalidation strategy | Not identified |
| Central cache abstraction | Not identified |

## 13. Architectural limitation

Cache logic is currently distributed across repositories and services. TTLs, key structure, locking behavior and error behavior are defined locally.

The current implementation therefore has effective specialized optimizations but no platform-wide cache contract or policy layer.

Future cache work should begin by preserving the behavior documented here and extracting common policy only after performance and correctness metrics are established.
