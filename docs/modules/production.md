# Production Module

## 1. Scope

The Production domain combines PlatformSSI-owned planning and safety data with operational information obtained through Plex and CCS-related proxy functions.

The frontend exposes OPS daily reporting, targets, safety, assistance and chair-related functionality.

The backend package is organized into models, repositories, serializers, services and views.

## 2. Persistent entities

Production owns BusinessUnit, WeeklyTarget, WeeklyWIP, OEERecord, PlantEmployee, AttendanceRecord, CcsAttendanceRecord, EarnedHoursRecord, SafetySettings, SafetyIncident and SafetyCounterEvent.

BusinessUnit, WeeklyTarget, WeeklyWIP and OEERecord support production planning and daily performance state.

The assistance entities support employee and attendance records.

The safety entities support the safety incident counter, incident history and counter-change audit events.

## 3. Targets service

TargetsService provides business-unit listing, weekly target retrieval and persistence, weekly WIP retrieval and persistence, and daily OEE retrieval and persistence.

WeeklyTarget and WeeklyWIP use a week-start date and business unit as their logical scope.

OEERecord is scoped by date.

## 4. Safety service

SafetyService validates plant context, retrieves and updates safety settings, lists incidents, creates incidents, updates incidents and returns safety counter events.

Safety API access uses explicit production permission classes in the view layer rather than only generic authentication.

The current view-level permission mapping includes ProductionRead, ProductionCreate and ProductionEdit according to operation.

## 5. Assistance service

AssistanceService manages PlatformSSI employee records and attendance information.

The service provides employee listing, creation, update, deactivation, reactivation, attendance retrieval, bulk attendance persistence, earned-hours retrieval, earned-hours persistence, deletion and date-range retrieval.

AttendancePolicy centralizes rules that determine zero-hour states, planned absence states, resolved attendance hours, resolved shift and attendance summary behavior.

## 6. CCS attendance integration

Production contains CCS-specific views that communicate with the Q-Wall proxy and SQL Server.

The API supports check-in, check-out, overtime registration, current attendance status, attendance record retrieval, attendance KPI retrieval, employee administration and employee reactivation.

The same integration path provides chair-control analytics.

CCS operational data is not owned by PostgreSQL unless it is explicitly persisted through a PlatformSSI model.

## 7. Chair-control functionality

The production API exposes chair KPI, break, daily-chart and shift-chart endpoints.

The Q-Wall proxy queries ssi_ChairUsage joined to ssi_production_employee.

The repository also contains a separate ssi_chairs package, but it is not registered in the reviewed LOCAL_APPS configuration. Active frontend and API behavior currently routes through production.

## 8. OPS Daily Report

OpsReportService obtains operational data through the Plex proxy and combines it with PlatformSSI data.

Confirmed service functions include daily production, daily COGP, scrap COGP, earned labor hours, yield by client, daily summary and weekly table generation.

The service includes percentage calculations for COGP and production.

It also calculates calendar helpers such as Monday and quarter ranges.

## 9. OPS cache behavior

OpsReportService uses Redis through the Django cache backend.

The default module TTL is 600 seconds.

Versioned key patterns are present for selected report results.

The service therefore avoids recomputing or re-querying stable report data on every request.

## 10. OPS exports

Production exposes daily export and PDF export endpoints.

The service directory contains ops_export_service.py and ops_pdf_service.py, separating report computation from output-format generation.

The backend dependency set includes openpyxl, WeasyPrint and ReportLab, which support spreadsheet and PDF output across the application.

## 11. Productivity

ProductivityService exposes daily productivity calculation with optional shift filtering.

The service is invoked through the productivity/daily API endpoint.

## 12. External dependencies

Production depends on PostgreSQL for PlatformSSI-owned state.

OPS reporting depends on the Plex proxy.

CCS attendance and chair analytics depend on the Q-Wall proxy and SQL Server.

Redis is used for report caching.

## 13. Frontend routes

| Route | Function |
|---|---|
| /production/ops-daily-report | OPS Daily Report |
| /production/targets | Production targets and related weekly values |
| /production/safety | Safety |
| /production/assistance | Attendance and assistance |
| /production/leysilla | Chair-related production view |

## 14. Architectural characteristics

Production is not a single-source domain. It combines locally persisted application state, Plex-derived operational data and CCS-derived employee and chair data.

Any future refactoring must preserve the source-of-truth distinction between PostgreSQL application records and externally owned operational records.
