# Warehouse Module

## 1. Scope

The Warehouse domain provides part-revision lookup, BOM hierarchy, clear-to-build BOM analysis and demand retrieval.

The current backend implementation is primarily a Plex proxy client and transformation layer rather than a PostgreSQL-owned warehouse domain.

## 2. Plex client

Warehouse defines PlexClient as the main integration abstraction.

The client reads PLEX_PROXY_URL and PLEX_PROXY_SECRET from Django settings.

HTTP communication uses httpx.

The client defines PlexProxyError for proxy-level failures.

## 3. Plex operations

Confirmed client operations include part revision retrieval, BOM hierarchy retrieval, BOM clear-to-build retrieval and demand retrieval.

BOM hierarchy and clear-to-build requests include part number and revision.

Demand can be filtered by customer and release status.

## 4. Service layer

WarehouseService sits above PlexClient and contains the application-level warehouse behavior.

The warehouse views call the service and expose normalized REST responses.

## 5. API

| Method | Path |
|---|---|
| GET | api/v1/warehouse/parts/{part_no}/revisions/ |
| GET | api/v1/warehouse/parts/{part_no}/bom/{revision}/ |
| GET | api/v1/warehouse/parts/{part_no}/ctb/{revision}/ |
| GET | api/v1/warehouse/demand/ |

All reviewed warehouse views require authenticated access.

## 6. Frontend routes

| Route | Function |
|---|---|
| /warehouse/ctb | BOM and clear-to-build view |
| /warehouse/demand | Demand view |

Warehouse demand navigation is restricted in the sidebar to supervisory roles.

## 7. Persistence boundary

No active Warehouse Django model was identified in the reviewed application structure.

The module should therefore be treated as an integration and presentation domain whose source of truth is Plex for the currently implemented operations.
