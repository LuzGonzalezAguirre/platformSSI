# Quality Module

## 1. Scope

Quality is the largest functional domain in the current PlatformSSI repository.

The module contains Q-Wall analytics, rejection reporting, Problem Control, COGP and scrap analytics, downtime, incoming inspection, failure catalogs, scan rules, quality targets, configurable translations and deterministic chatbot support.

Because these areas have different data sources and persistence models, detailed documents exist for the major subdomains.

## 2. Main subdomains

| Subdomain | Primary data ownership |
|---|---|
| Q-Wall reporting | SQL Server through Q-Wall proxy, with Redis-derived caches |
| Q-Wall settings | SQL Server and selected PostgreSQL settings/translations |
| Rejection reporting | SQL Server through Q-Wall proxy |
| Problem Control | PostgreSQL |
| COGP | Plex plus PostgreSQL synchronized or calculated state, with Redis caches |
| Incoming Inspection | Plex synchronized into PostgreSQL |
| Downtime | External operational data plus PostgreSQL assignments |
| Quality targets | PostgreSQL |
| Failure catalog images and translations | PostgreSQL plus Q-Wall catalog data |
| Scan rules | Q-Wall proxy and SQL Server |
| Chatbot templates and feedback | PostgreSQL |

## 3. Quality targets

QualityTarget stores minimum yield and maximum scrap thresholds at configurable levels.

Targets can be scoped to business unit or workcenter.

## 4. Scrap detail

QualityService obtains scrap detail through QualityPlexClient.

The service aggregates source payloads and builds a cache key from the date range and shift-selection state.

This path represents direct Plex-derived quality reporting rather than synchronized COGP persistence.

## 5. Rejection reporting

RejectionService obtains rejection data and rejection photos through the Q-Wall repository and proxy path.

Test work orders can be filtered from reporting.

The API exposes rejection report data, photo retrieval and PDF generation.

## 6. Failure catalog

The Quality domain contains failure catalog views and services.

FailureModeImage stores failure-mode images in PostgreSQL as base64 data with MIME type metadata.

FailModeTranslation stores localized failure-mode names.

Catalog structure and source failure modes are also retrieved from the Q-Wall system.

## 7. Downtime

DowntimeService caches raw log data for 10 minutes and then applies PlatformSSI filter context and aggregation.

The service provides log, summary and trend operations.

Downtime assignment services persist inspector assignment information in PostgreSQL through DowntimeGroupAssignment and DowntimeWorkcenterAssignment.

DowntimeWorkcenter stores the PlatformSSI-managed workcenter catalog used by assignment functions.

## 8. Chatbot support

The Quality domain contains a deterministic chatbot subsystem based on ChatbotQuestionTemplate.

Question templates store bilingual questions and response templates, a service method reference, required filters, allowed roles and configuration parameters.

Feedback and suggestion models capture user response quality and new question requests.

The reviewed route surface exposes preloaded questions, feedback and suggestions.

This subsystem should not be described as a general LLM runtime solely from the current repository implementation.

## 9. Background processing

Quality owns Celery tasks for COGP synchronization, COGP offender staging, COGP cache warming, Incoming Inspection snapshot and history synchronization, Incoming Inspection refresh and downtime workcenter synchronization.

## 10. Frontend scope

Quality frontend routes include the main dashboard, quality panel, Problem Control, Incoming Inspection, downtime, COGP, scrap rate, Q-Wall reporting, Q-Wall dashboard, rejection reporting, Q-Wall catalog, Q-Wall settings and Q-Wall help.

## 11. Architectural characteristic

Quality is a composite domain rather than a single bounded data source.

Its codebase already contains dedicated repositories and services for several subdomains, but some functionality still relies on direct proxy-aware code within views or local service modules.

Detailed current-state behavior is documented separately by subdomain.
