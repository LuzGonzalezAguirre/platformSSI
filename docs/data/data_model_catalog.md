# PlatformSSI Persistent Data Model Catalog

## 1. Scope

This document catalogs persistent Django models confirmed in the current repository. It describes PlatformSSI-owned PostgreSQL entities separately from data accessed through external systems.

The catalog reflects application source code rather than database introspection. Tables created exclusively by external SQL scripts are documented in the integration documentation.

## 2. Identity domain

### 2.1 User

The custom User model extends Django AbstractUser and uses employee_id as a principal business identifier.

| Field | Purpose |
|---|---|
| employee_id | Employee identifier and JWT user identifier |
| roles | Many-to-many relationship to configured roles |
| plant | Assigned plant |
| job_title | Job title |
| preferred_language | User language preference |
| preferred_theme | User interface theme preference |
| timezone | User timezone preference |
| last_login_at | Application-specific last login timestamp |
| is_active | Application active status |
| avatar | User profile image |

## 3. Permission domain

### 3.1 Permission

Represents a permission key classified by module and action.

### 3.2 Role

Represents a named permission group. Role permissions are implemented through RolePermission.

### 3.3 RolePermission

Join entity connecting roles and permissions.

### 3.4 UserPermissionOverride

Represents an explicit per-user permission override.

### 3.5 UserRole

Represents the relationship between users and roles.

## 4. Audit domain

### 4.1 AuditLog

AuditLog records user activity with action, module, resource, resource identifier, description, IP address, user agent and timestamp.

### 4.2 ProblemAudit

Problem Control maintains a separate domain-specific audit entity containing problem, user, timestamp, action, change data and IP address.

## 5. Notification domain

### 5.1 Notification

Notification stores application notifications and task-oriented alerts.

| Field | Purpose |
|---|---|
| recipient | Notification recipient |
| actor | User responsible for originating activity when applicable |
| notification_type | Logical notification type |
| title | Notification title |
| message | Notification body |
| module | Originating module |
| entity_type | Related entity type |
| entity_id | Related entity identifier |
| action_url | Frontend navigation target |
| metadata | Additional JSON context |
| event_key | Unique idempotency key |
| is_task | Indicates task-oriented notification |
| read_at | Read timestamp |
| resolved_at | Resolution timestamp |
| created_at | Creation timestamp |
| updated_at | Last update timestamp |

The unique event_key provides a persistence-level mechanism for notification deduplication.

## 6. Production domain

### 6.1 BusinessUnit

Stores active business-unit codes and names used by production planning functions.

### 6.2 WeeklyTarget

Stores a business-unit weekly target and optional daily target values.

### 6.3 WeeklyWIP

Stores weekly and daily actual and goal quantities by business unit.

### 6.4 OEERecord

Stores daily availability, performance, quality and OEE percentages.

### 6.5 PlantEmployee

Stores PlatformSSI employee information used by attendance functions, including department, shift, barcode identifier and optional link to the application user.

### 6.6 AttendanceRecord

Stores PlatformSSI attendance status, shift, hours and recording user by employee and date.

### 6.7 CcsAttendanceRecord

Stores attendance data linked to an external CCS employee identifier.

### 6.8 EarnedHoursRecord

Stores earned hours by date with optional notes and recording user.

### 6.9 SafetySettings

Stores plant-level safety counter configuration and last incident information.

### 6.10 SafetyIncident

Stores incident date, incident type, severity, area, description, immediate actions, root cause, status and reporting user.

### 6.11 SafetyCounterEvent

Stores changes affecting the safety counter, including previous and new incident dates, previous day count, source and reason.

## 7. Maintenance domain

### 7.1 CorrectiveAction

Stores maintenance corrective actions, priority, equipment information, root cause, failure type, corrective action description, assignment, due date, closure information, status and audit timestamps.

### 7.2 CorrectiveActionComment

Stores comments attached to maintenance corrective actions.

### 7.3 CorrectiveActionHistory

Stores selected field changes for corrective actions, including old value, new value, user and timestamp.

### 7.4 MaintenanceDashboardTarget

Stores configurable maintenance dashboard targets with metric key, target value, comparison operator, bilingual labels and unit.

## 8. Quality general domain

### 8.1 QualityTarget

Stores quality target configuration at a defined level, optionally scoped by business unit or workcenter. The model includes minimum yield and maximum scrap percentages.

### 8.2 QWallSettings

Stores the Q-Wall pass-rate target and update audit information.

### 8.3 FailureModeImage

Stores an image associated with an inspection point and failure mode. Image content is currently represented as base64 data in PostgreSQL.

### 8.4 FailModeTranslation

Stores localized names for fail-mode codes.

### 8.5 DefectType

Stores configurable defect type code, description and active state.

### 8.6 SeverityLevel

Stores severity level and contextual notes for customer, internal, supplier and audit scenarios.

### 8.7 Holiday

Stores calendar holidays and whether they recur.

## 9. Quality downtime domain

### 9.1 DowntimeGroupAssignment

Stores inspector assignment by date, group and optional subgroup.

### 9.2 DowntimeWorkcenter

Stores managed downtime workcenters and their workcenter group.

### 9.3 DowntimeWorkcenterAssignment

Stores inspector assignment to a downtime workcenter for a specific date.

## 10. Incoming Inspection domain

### 10.1 IncomingContainerSnapshot

Stores the current synchronized container state obtained from the source system, including container key, part, operation, location, quantity, active state and sync timestamp.

### 10.2 IncomingContainerHistory

Stores synchronized historical container changes including serial number, part, operation, change date, action, location, container status, defect type, note and changed-by information.

### 10.3 IncomingInspectionSLAConfig

Stores the configured SLA threshold in hours and its previous value.

### 10.4 IncomingInspectionSyncState

Stores synchronization state by sync type, last synchronization timestamp, last run status and last error.

### 10.5 IncomingRejectionComment

Stores comments attached to incoming-inspection rejection serial numbers.

## 11. Problem Control domain

### 11.1 ProblemCategoryCatalog

Configurable Problem Control category catalog.

### 11.2 ProblemTypeCatalog

Configurable Problem Control problem-type catalog.

### 11.3 Problem

Problem is the central Problem Control aggregate.

The model contains customer and supplier references, problem descriptions, classification, severity, part and workcenter context, affected quantities, location, champion, team membership, response dates, D3 through D8 completion timestamps, FMEA and Control Plan responsibilities, SLA values, approval assignments, approval timestamps, override controls, creation and closure audit fields and recurrence information.

The model therefore combines the primary problem record with workflow state and approval state.

### 11.4 FiveWhyAnalysis

Stores five-why analysis by problem and category.

### 11.5 RootCause

Stores root-cause rows related to a FiveWhyAnalysis, including why values, associated corrective-action text and final-selection state.

### 11.6 ContainmentAction

Stores D3 containment actions with dates, action description, response and responsible user.

### 11.7 CorrectiveAction

Stores Problem Control corrective actions related to a problem and root cause.

This model is distinct from the maintenance CorrectiveAction model.

### 11.8 VerificationAction

Stores verification actions associated with a problem.

### 11.9 PreventionAction

Stores prevention actions associated with a problem.

### 11.10 ProblemControlSettings

Stores Problem Control configuration including the quality manager and update audit fields.

## 12. COGP domain

### 12.1 COGPDailySummary

Stores calculated daily COGP summary by report date and business unit, including scrap cost, extended cost and COGP percentage.

### 12.2 CogpSettings

Stores COGP cost and pieces target percentages.

### 12.3 CustomerPartMapping

Stores part-to-customer and part-to-business-unit classification information with classification source and synchronization timestamp.

### 12.4 ProductionRecord

Stores synchronized production records by date, part, workcenter, quantity, extended cost, cost model and business unit.

### 12.5 ScrapRecord

Stores synchronized scrap records including date, part, serial, quantity, weight, reason, workcenter, workcenter group, department, cost, note and business unit.

## 13. Chatbot support domain

### 13.1 ChatbotQuestionTemplate

Stores deterministic question templates with bilingual question and answer text, response type, service method reference, required filters, allowed roles, configuration parameters and display order.

### 13.2 ChatbotFeedback

Stores whether a response template was helpful and records the filter context used.

### 13.3 ChatbotSuggestion

Stores user suggestions for chatbot functionality and review state.

## 14. Q-Wall lot sampling persistence boundary

Migration 0008 created PostgreSQL models named QWallLotSetting, QWallLotModelSetting and QWallSamplingCell.

Migration 0009 subsequently removed those PostgreSQL models.

The current operational SQL script creates equivalent lot-sampling configuration objects in SQL Server under dbo.ssi_QWallLotSettings, dbo.ssi_QWallLotModelSettings and dbo.ssi_QWallSamplingMatrix.

For the current architecture, Q-Wall lot sampling must therefore be treated as externally persisted SQL Server configuration rather than active PostgreSQL Django models.

## 15. Data ownership boundary

PostgreSQL owns PlatformSSI application state represented by active Django models.

Plex data is retrieved through the Plex proxy and may be transformed or synchronized into selected PostgreSQL models such as COGP and Incoming Inspection entities.

Q-Wall and CCS operational data is accessed through the Q-Wall proxy and SQL Server.

Action Tracker related operational records are queried or staged through the Q-Wall proxy and SQL Server integration.

A future database dictionary should add physical table names, indexes, constraints and relationship diagrams after direct schema verification.
