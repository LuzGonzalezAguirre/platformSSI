# Django Migration History

## 1. Scope

This document records the migration sequence currently present in the repository. It is intended to explain schema evolution and to distinguish historical schema decisions from the active model state.

## 2. Audit

### 2.1 0001_initial

Creates AuditLog.

### 2.2 0002_initial

Adds the user relationship to AuditLog.

## 3. Identity

### 3.1 0001_initial

Creates the custom User model.

### 3.2 0002_initial

Adds role and Django user-permission relationships to the custom user.

## 4. Permissions

### 4.1 0001_initial

Creates Role, Permission, RolePermission, UserPermissionOverride and UserRole.

The migration also establishes the role-to-permission many-to-many relationship and related constraints.

## 5. Notifications

### 5.1 0001_initial

Creates Notification.

## 6. Maintenance

### 6.1 0001_initial

Creates CorrectiveAction, CorrectiveActionComment, CorrectiveActionHistory and MaintenanceDashboardTarget.

## 7. Production

### 7.1 0001_initial

Creates BusinessUnit, EarnedHoursRecord, OEERecord, PlantEmployee, SafetyIncident, SafetySettings, SafetyCounterEvent, WeeklyTarget, WeeklyWIP, CcsAttendanceRecord and AttendanceRecord.

The migration also creates constraints and relationships for weekly target and WIP data.

### 7.2 0002_alter_attendancerecord_status

Alters the AttendanceRecord status field.

## 8. Quality

### 8.1 0001_initial

The first Quality migration establishes the majority of the current Quality data model.

Created entities include DowntimeWorkcenter, Holiday, IncomingInspectionSyncState, SeverityLevel, ChatbotQuestionTemplate, ChatbotFeedback, ChatbotSuggestion, COGPDailySummary, CustomerPartMapping, DefectType, FailModeTranslation, IncomingContainerHistory, IncomingContainerSnapshot, IncomingInspectionSLAConfig, Problem, PreventionAction, FiveWhyAnalysis, ContainmentAction, ProblemAttachment, ProblemAudit, ProblemNote, ProductionRecord, QualityTarget, QWallSettings, RootCause, CorrectiveAction, ScrapRecord, VerificationAction, DowntimeWorkcenterAssignment, FailureModeImage and IncomingRejectionComment.

### 8.2 0002_downtimegroupassignment

Creates DowntimeGroupAssignment.

### 8.3 0003_alter_customerpartmapping_classification_source

Alters CustomerPartMapping.classification_source.

### 8.4 0004_problemcategorycatalog_problemtypecatalog

Creates ProblemCategoryCatalog and ProblemTypeCatalog.

### 8.5 0005_problem_control_d2_d6_workflow

Extends Problem Control workflow state.

The migration adds manufacturing, production and maintenance approvers together with their approval timestamps.

It adds active state to the Quality CorrectiveAction model.

It adds corrective_action to RootCause.

It executes a data migration to recompute root-cause data and adds an index to Problem.

### 8.6 0006_problemcontrolsettings

Creates ProblemControlSettings.

### 8.7 0007_cogpsettings

Creates CogpSettings.

### 8.8 0008_qwall_lot_sampling

Creates PostgreSQL QWallLotSetting, QWallSamplingCell and QWallLotModelSetting.

It adds unique constraints and runs a sampling-matrix seed operation.

### 8.9 0009_remove_postgres_lot_sampling

Runs a validation step to ensure saved configuration can be removed safely and then deletes QWallLotModelSetting, QWallLotSetting and QWallSamplingCell.

This migration is the reason those models must not be treated as current PostgreSQL entities.

The equivalent active configuration is represented by SQL Server tables managed through the Q-Wall proxy.

## 9. Direct SQL reconciliation

The repository also contains ops/db/2026-08-05_prod_reconcile.sql.

That file directly reconciles selected Production safety objects in PostgreSQL and exists outside the migration sequence.

Schema reconstruction must therefore consider both Django migrations and this operational reconciliation asset.

## 10. Migration coverage boundary

No migration directories were identified for Warehouse, Analytics, Core, Integrations, Manufacturing, ssi_attendance, ssi_chairs or ssi_common in the reviewed tree.

This is consistent with the fact that several of those packages either contain no active Django-owned models or are not registered as installed applications in the current settings.
