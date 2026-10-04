# Q-Wall Module

## 1. Scope

The PlatformSSI Q-Wall area provides inspection reporting, pass-rate and failure analytics, business-unit and part-number summaries, rejection information, configuration administration, failure-mode translations, lot-sampling configuration and scan-rule management.

The operational inspection source is SQL Server accessed through the Q-Wall proxy.

## 2. Runtime flow

A typical Q-Wall report request follows this path.

React Quality module

Django quality API

QWallService

QWallRepository

Redis cache lookup

Q-Wall proxy when cache misses

SQL Server Q-Wall tables

The service layer then performs filtering and aggregation before returning the API response.

## 3. QWallRepository

QWallRepository retrieves inspections, piece flags, flag counts, business units, part numbers and inspection-point failures.

Repository-level cache TTL is 300 seconds.

Repository cache keys include date and business-unit scope where applicable.

Proxy request timeout is currently 120 seconds.

## 4. QWallService

QWallService provides the higher-level reporting model.

Confirmed operations include report aggregation, changeover calculation, business-unit summary, part-number summary, shift grouping, fail-by-point analysis, fail-mode ranking, Pareto analysis and trend analysis.

The service also loads and caches the pass-rate target.

Service-level aggregate responses use a 300-second TTL.

## 5. Test work orders

QWallService contains explicit filtering behavior for test work orders.

The include_test parameter controls whether test work orders participate in reporting.

## 6. Failure-mode localization

FailModeTranslation stores translated names in PostgreSQL.

QWallService applies translations to failure-mode names according to requested locale.

The Q-Wall settings API also exposes missing-translation lookup and update behavior.

## 7. Rejection reporting

Rejection reporting is sourced through the Q-Wall proxy.

The proxy joins inspections, results, inspection points, business units, fail modes, products and users.

Rejection photos are read from ssi_RejectionPhotos.

PlatformSSI provides a PDF rejection-report output endpoint.

## 8. Q-Wall administration

Q-Wall settings APIs expose business units, roles, users, part numbers, inspection points, fail modes, fail-mode-to-inspection-point assignment and system configuration.

Most of this configuration is passed through the Q-Wall proxy to SQL Server.

PlatformSSI separately owns the QWallSettings pass-rate target in PostgreSQL.

## 9. Lot sampling

Lot-sampling persistence currently lives in SQL Server.

The primary tables are dbo.ssi_QWallLotSettings, dbo.ssi_QWallLotModelSettings and dbo.ssi_QWallSamplingMatrix.

General mode stores a business-unit-level lot size.

BY_MODEL mode stores part-specific lot sizes.

The sampling matrix maps lot ranges and inspection indexes to sample size.

The Django API provides matrix retrieval, configuration listing and per-business-unit get or update.

The frontend exposes lot configuration through Q-Wall Settings.

## 10. Lot-sampling migration history

PostgreSQL lot-sampling models were created in Quality migration 0008 and removed in migration 0009.

Current documentation must use SQL Server as the active persistence source.

## 11. Scan rules

Scan rules have a dedicated Q-Wall proxy router.

The PlatformSSI API exposes rule listing, creation, retrieval, patch, deletion, toggle and part-number lookup.

Scan-rule persistence is outside the PostgreSQL Django model catalog reviewed for this documentation.

## 12. SQL Server objects

Q-Wall operations reference ssi_Inspections, ssi_InspectionResults, ssi_ResultFailModes, ssi_InspectionPoints, ssi_FailModes, ssi_InspectionPointFailModes, ssi_Products, ssi_PartNumbers, ssi_BusinessUnits, ssi_Users, ssi_Roles, ssi_RejectionPhotos, ssi_PieceFlagRecords and ssi_SystemConfig among other integration tables.

## 13. Frontend routes

| Route | Function |
|---|---|
| /quality/qwall | Q-Wall report |
| /quality/qwall-dashboard | Q-Wall dashboard |
| /quality/rejections | Rejection reporting |
| /quality/qwall/catalog | Failure catalog |
| /quality/qwall/settings | Q-Wall administration and lot settings |
| /quality/qwall/help | Q-Wall help |

## 14. Cache characteristic

Q-Wall currently has both repository-level raw-data caching and service-level derived-response caching.

Both levels use the configured Django Redis backend.

This behavior must be considered when tracing freshness, invalidation and cache hit behavior.
