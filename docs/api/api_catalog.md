# PlatformSSI REST API Catalog

## 1. Scope

This catalog records the REST endpoints wired into the current Django URL configuration. HTTP methods are derived from the corresponding view implementation rather than inferred from endpoint names.

Unless a view explicitly overrides permission behavior, the project-level Django REST Framework default is authenticated access.

The base prefix for application APIs is api/v1.

## 2. Authentication and identity

Base path: api/v1/auth

| Method | Path | View | Access |
|---|---|---|---|
| POST | login/ | LoginView | AllowAny |
| POST | logout/ | LogoutView | IsAuthenticated |
| POST | refresh/ | RefreshView | AllowAny |
| GET, PATCH | me/ | MeView | IsAuthenticated |
| PATCH | me/update/ | ProfileUpdateView | IsAuthenticated |
| POST | me/change-password/ | ChangePasswordView | IsAuthenticated |
| POST | me/avatar/ | AvatarUploadView | IsAuthenticated |
| GET, POST | users/ | UserListCreateView | IsAuthenticated |
| GET, PATCH | users/{user_id}/ | UserDetailView | IsAuthenticated |
| POST | users/{user_id}/toggle-active/ | ToggleActiveView | IsAuthenticated |
| POST | users/{user_id}/reset-password/ | ResetPasswordView | IsAuthenticated |
| GET | roles/ | RoleChoicesView | IsAuthenticated |

## 3. Permissions

Base path: api/v1/permissions

| Method | Path | View | Access |
|---|---|---|---|
| GET | / | PermissionChoicesView | IsAuthenticated |
| GET, POST | roles/ | RoleListCreateView | IsAuthenticated |
| GET, PUT, DELETE | roles/{slug}/ | RoleDetailView | IsAuthenticated |
| GET, POST | users/{user_id}/ | UserPermissionsView | IsAuthenticated |
| GET | me/ | MyPermissionsView | IsAuthenticated |

## 4. Audit

Base path: api/v1/audit

| Method | Path | View | Access |
|---|---|---|---|
| GET | users/ | AuditUserListView | IsAuthenticated |
| GET | logs/ | AuditLogListView | IsAuthenticated |

## 5. Notifications

Base path: api/v1/notifications

| Method | Path | View | Access |
|---|---|---|---|
| GET | / | NotificationListView | IsAuthenticated |
| POST | read-all/ | NotificationReadAllView | IsAuthenticated |
| POST | {id}/read/ | NotificationReadView | IsAuthenticated |

## 6. Production

Base path: api/v1/production

### 6.1 Targets, WIP and OEE

| Method | Path | View | Access |
|---|---|---|---|
| GET | business-units/ | BusinessUnitListView | IsAuthenticated |
| GET, POST | targets/weekly/ | WeeklyTargetView | IsAuthenticated |
| GET, POST | wip/weekly/ | WeeklyWIPView | IsAuthenticated |
| GET, POST | ops/oee/ | OEERecordView | IsAuthenticated |

### 6.2 Safety

| Method | Path | View | Access |
|---|---|---|---|
| GET, PATCH | safety/settings/ | SafetySettingsView | ProductionEdit |
| GET, POST | safety/incidents/ | SafetyIncidentListCreateView | ProductionCreate |
| PATCH | safety/incidents/{id}/ | SafetyIncidentUpdateView | ProductionEdit |
| GET | safety/counter-history/ | SafetyCounterHistoryView | ProductionRead |

The current permission classes on Safety views are more specific than the project default and represent module-level permission enforcement.

### 6.3 PlatformSSI employee attendance

| Method | Path | View | Access |
|---|---|---|---|
| GET, POST | employees/ | PlantEmployeeListCreateView | IsAuthenticated |
| PATCH, DELETE | employees/{id}/ | PlantEmployeeDetailView | IsAuthenticated |
| POST | employees/{id}/reactivate/ | PlantEmployeeReactivateView | IsAuthenticated |
| GET, POST | attendance/ | AttendanceView | IsAuthenticated |
| GET, POST, DELETE | earned-hours/ | EarnedHoursView | IsAuthenticated |

### 6.4 CCS attendance

| Method | Path | View | Access |
|---|---|---|---|
| GET, POST | ccs/attendance/daily/ | CcsAttendanceDailyView | IsAuthenticated |
| POST | ccs/check-in/ | CcsCheckInView | IsAuthenticated |
| POST | ccs/check-out/ | CcsCheckOutView | IsAuthenticated |
| POST | ccs/overtime/ | CcsOvertimeView | IsAuthenticated |
| GET | ccs/today-status/ | CcsTodayStatusView | IsAuthenticated |
| POST | ccs/attendance/records/ | CcsAttendanceRecordsView | IsAuthenticated |
| POST | ccs/attendance/kpis/ | CcsAttendanceKpisView | IsAuthenticated |
| GET, POST | ccs/employees/ | CcsEmployeesView | IsAuthenticated |
| PATCH, DELETE | ccs/employees/{id}/ | CcsEmployeeDetailView | IsAuthenticated |
| POST | ccs/employees/{id}/reactivate/ | CcsEmployeeReactivateView | IsAuthenticated |

### 6.5 Chair-control analytics

| Method | Path | View | Access |
|---|---|---|---|
| POST | chairs/kpis/ | ChairKpisView | IsAuthenticated |
| POST | chairs/breaks/ | ChairBreaksView | IsAuthenticated |
| POST | chairs/daily-chart/ | ChairDailyChartView | IsAuthenticated |
| POST | chairs/turno-chart/ | ChairTurnoChartView | IsAuthenticated |

### 6.6 OPS reporting and productivity

| Method | Path | View | Access |
|---|---|---|---|
| GET | ops/daily-summary/ | OpsDailySummaryView | IsAuthenticated |
| GET | ops/weekly-table/ | OpsWeeklyTableView | IsAuthenticated |
| GET | ops/export/daily/ | OpsDailyExportView | IsAuthenticated |
| GET | ops/export/pdf/ | OpsDailyPDFExportView | IsAuthenticated |
| GET | productivity/daily/ | DailyProductivityView | IsAuthenticated |

## 7. Maintenance

Base path: api/v1/maintenance

| Method | Path | View | Access |
|---|---|---|---|
| GET | overview/kpis/ | MaintenanceKPIView | IsAuthenticated |
| GET | overview/reasons/ | MaintenanceReasonsView | IsAuthenticated |
| GET | overview/detail/ | MaintenanceDetailView | IsAuthenticated |
| GET | overview/oee-trend/ | OEETrendView | IsAuthenticated |
| GET | overview/downtime-by-month/ | DowntimeByMonthView | IsAuthenticated |
| GET | overview/oee-live/ | OEELiveView | IsAuthenticated |
| GET, PUT | overview/targets/ | DashboardTargetsView | IsAuthenticated |
| GET | work-requests/dashboard/ | WorkRequestsDashboardView | IsAuthenticated |
| GET | down-equipment/dashboard/ | DownEquipmentDashboardView | IsAuthenticated |
| GET, POST | corrective-actions/ | CorrectiveActionListCreateView | IsAuthenticated |
| GET, PATCH, DELETE | corrective-actions/{id}/ | CorrectiveActionDetailView | IsAuthenticated |
| POST | corrective-actions/{id}/comments/ | CorrectiveActionCommentView | IsAuthenticated |
| GET | corrective-actions/metrics/ | CorrectiveActionMetricsView | IsAuthenticated |
| GET | equipment-catalog/ | EquipmentCatalogView | IsAuthenticated |
| GET | assignee-catalog/ | AssigneeCatalogView | IsAuthenticated |
| GET | pmp/calendar/ | PmpCalendarView | IsAuthenticated |

The root URL configuration currently includes the maintenance URL module twice. This does not represent a second maintenance API; it is a duplicated URL registration in config/urls.py.

## 8. Warehouse

Base path: api/v1/warehouse

| Method | Path | View | Access |
|---|---|---|---|
| GET | parts/{part_no}/revisions/ | PartRevisionsView | IsAuthenticated |
| GET | parts/{part_no}/bom/{revision}/ | BomHierarchyView | IsAuthenticated |
| GET | parts/{part_no}/ctb/{revision}/ | BomCtbView | IsAuthenticated |
| GET | demand/ | DemandView | IsAuthenticated |

## 9. Quality general API

Base path: api/v1/quality

### 9.1 Scrap and targets

| Method | Path | View | Access |
|---|---|---|---|
| GET | scrap-detail/ | ScrapDetailView | IsAuthenticated |
| GET, POST | targets/ | QualityTargetView | IsAuthenticated |
| GET, POST, PUT | targets/{id}/ | QualityTargetView | IsAuthenticated |

The QualityTargetView supports GET, POST and PUT in its implementation. Exact behavior differs according to whether a primary key is present.

### 9.2 Q-Wall reporting

| Method | Path | View | Access |
|---|---|---|---|
| GET | qwall/ | QWallReportView | IsAuthenticated |
| GET | qwall/trend/ | QWallTrendView | IsAuthenticated |
| GET | qwall/pareto/ | QWallParetoView | IsAuthenticated |
| GET | qwall/fail-by-point/ | QWallFailByPointView | IsAuthenticated |
| GET | qwall/bu-summary/ | QWallBuSummaryView | IsAuthenticated |
| GET | qwall/part-number-summary/ | QWallPartNumberSummaryView | IsAuthenticated |
| GET | qwall/part-numbers/ | QWallPartNumbersView | IsAuthenticated |

### 9.3 Rejection reporting

| Method | Path | View | Access |
|---|---|---|---|
| GET | rejection-report/ | RejectionReportView | IsAuthenticated |
| GET | rejection-photo/{inspection_id}/ | RejectionPhotoView | IsAuthenticated |
| GET | rejection-report/pdf/ | RejectionReportPDFView | IsAuthenticated |

### 9.4 Quality catalog and downtime

| Method | Path | View | Access |
|---|---|---|---|
| GET | catalog/structure/ | CatalogStructureView | IsAuthenticated |
| GET, POST, DELETE | catalog/ | FailureCatalogView | IsAuthenticated |
| GET | downtime/logs/ | DowntimeLogsView | IsAuthenticated |
| GET | downtime/trend/ | DowntimeTrendView | IsAuthenticated |
| GET | downtime/summary/ | DowntimeSummaryView | IsAuthenticated |
| GET | downtime/workcenters/ | DowntimeWorkcentersView | IsAuthenticated |
| GET, PUT | downtime/assignments/ | DowntimeAssignmentsView | IsAuthenticated |

## 10. Problem Control

Base path: api/v1/quality

### 10.1 Problem workflow

| Method | Path | View | Access |
|---|---|---|---|
| GET, POST | problems/ | ProblemListCreateView | IsAuthenticated |
| GET | problems/my-approval-assignments/ | MyApprovalAssignmentsView | IsAuthenticated |
| GET, PUT, DELETE | problems/{id}/ | ProblemDetailView | IsAuthenticated |
| POST | problems/{id}/submit/ | ProblemSubmitForFinalApprovalView | IsAuthenticated |
| POST | problems/{id}/approve/ | ProblemApproveView | IsAuthenticated |
| POST | problems/{id}/department-approval/ | ProblemDepartmentApprovalView | IsAuthenticated |
| GET, POST | problems/{id}/final-approvals/ | AssignedProblemFinalApprovalView | IsAuthenticated |
| POST | problems/{id}/reject/ | ProblemRejectView | IsAuthenticated |
| POST | problems/{id}/close/ | ProblemCloseView | IsAuthenticated |
| POST | problems/{id}/override/request/ | ProblemOverrideRequestView | IsAuthenticated |
| POST | problems/{id}/override/approve/ | ProblemOverrideApproveView | IsAuthenticated |

### 10.2 Problem Control settings and catalogs

| Method | Path | View | Access |
|---|---|---|---|
| GET, PUT | problem-control-settings/ | ProblemControlSettingsView | IsAuthenticated |
| GET | severity-levels/ | SeverityLevelListView | IsAuthenticated |
| GET, POST | defect-types/ | DefectTypeListView | IsAuthenticated |
| PUT, DELETE | defect-types/{id}/ | DefectTypeDetailView | IsAuthenticated |
| GET | quality-users/ | QualityUsersListView | IsAuthenticated |
| GET | approval-users/ | ApprovalUsersListView | IsAuthenticated |
| GET | quality-managers/ | QualityManagersListView | IsAuthenticated |
| GET, POST | problem-categories/ | ProblemCategoryListCreateView | IsAuthenticated |
| PUT, DELETE | problem-categories/{id}/ | ProblemCategoryDetailView | IsAuthenticated |
| GET, POST | problem-types/ | ProblemTypeListCreateView | IsAuthenticated |
| PUT, DELETE | problem-types/{id}/ | ProblemTypeDetailView | IsAuthenticated |

### 10.3 D3 through D7 supporting entities

| Method | Path | View | Access |
|---|---|---|---|
| GET, POST | containment-actions/ | ContainmentActionListCreateView | IsAuthenticated |
| PUT, DELETE | containment-actions/{id}/ | ContainmentActionDetailView | IsAuthenticated |
| GET, POST | five-why-analyses/ | FiveWhyAnalysisListCreateView | IsAuthenticated |
| PUT, DELETE | five-why-analyses/{id}/ | FiveWhyAnalysisDetailView | IsAuthenticated |
| GET, POST | root-causes/ | RootCauseListCreateView | IsAuthenticated |
| PUT, DELETE | root-causes/{id}/ | RootCauseDetailView | IsAuthenticated |
| GET, POST | corrective-actions/ | CorrectiveActionListCreateView | IsAuthenticated |
| PUT, DELETE | corrective-actions/{id}/ | CorrectiveActionDetailView | IsAuthenticated |
| GET, POST | verification-actions/ | VerificationActionListCreateView | IsAuthenticated |
| PUT, DELETE | verification-actions/{id}/ | VerificationActionDetailView | IsAuthenticated |
| GET, POST | prevention-actions/ | PreventionActionListCreateView | IsAuthenticated |
| PUT, DELETE | prevention-actions/{id}/ | PreventionActionDetailView | IsAuthenticated |

### 10.4 Attachments and notes

| Method | Path | View | Access |
|---|---|---|---|
| POST | attachments/upload/ | ProblemAttachmentUploadView | IsAuthenticated |
| GET | attachments/ | ProblemAttachmentListView | IsAuthenticated |
| DELETE | attachments/{id}/ | ProblemAttachmentDeleteView | IsAuthenticated |
| GET, POST | notes/ | ProblemNoteListCreateView | IsAuthenticated |
| PUT, DELETE | notes/{id}/ | ProblemNoteDetailView | IsAuthenticated |

## 11. COGP

Base path: api/v1/quality/cogp

| Method | Path | View | Access |
|---|---|---|---|
| GET, PUT | settings/ | CogpSettingsView | IsAuthenticated |
| POST | scrap-integration/test/ | CogpScrapIntegrationTestView | IsAuthenticated |
| POST | scrap-integration/current-offenders/ | CogpCurrentOffendersView | IsAuthenticated |
| GET | summary/ | CogpSummaryView | IsAuthenticated |
| GET | weekly-trend/ | CogpWeeklyTrendView | IsAuthenticated |
| GET | mapping/ | CogpMappingCatalogView | IsAuthenticated |
| GET | pareto/ | CogpParetoView | IsAuthenticated |
| GET | scrap-rate/ | ScrapRateWeeklyView | IsAuthenticated |

## 12. Incoming Inspection

Base path: api/v1/quality/incoming-inspection

| Method | Path | View | Access |
|---|---|---|---|
| POST | refresh/ | IncomingInspectionRefreshView | IsAuthenticated |
| GET | refresh/{task_id}/ | IncomingInspectionRefreshStatusView | IsAuthenticated |
| GET | dashboard/ | IncomingInspectionDashboardView | IsAuthenticated |
| GET | pending/ | IncomingInspectionPendingView | IsAuthenticated |
| GET | kpis/ | IncomingInspectionKPIsView | IsAuthenticated |
| GET | detail/ | IncomingInspectionDetailView | IsAuthenticated |
| GET, PATCH | sla-config/ | IncomingInspectionSLAConfigView | IsAuthenticated |
| GET | rejected-lots/ | IncomingRejectedLotsView | IsAuthenticated |
| GET, POST | rejected-lots/{serial_no}/comments/ | IncomingRejectionCommentsView | IsAuthenticated |
| POST | user-lookup/ | IncomingUserLookupView | IsAuthenticated |

## 13. Q-Wall settings

Base path: api/v1/quality/qwall/settings

| Method | Path | View | Access |
|---|---|---|---|
| GET | lot-sampling/matrix/ | QWallSamplingMatrixView | IsAuthenticated plus view-level access check |
| GET | lot-sampling/configurations/ | QWallLotConfigurationsView | IsAuthenticated plus view-level access check |
| GET, PUT | lot-sampling/{bu_id}/ | QWallLotConfigurationView | IsAuthenticated plus view-level access check |
| GET | business-units/ | QWallBusinessUnitsView | IsAuthenticated |
| GET | qwall-roles/ | QWallRolesView | IsAuthenticated |
| GET, POST | users/ | QWallUsersView | IsAuthenticated |
| PATCH, DELETE | users/{user_id}/ | QWallUserDetailView | IsAuthenticated |
| GET, POST | part-numbers/ | QWallPartNumbersView | IsAuthenticated |
| PATCH, DELETE | part-numbers/{pn_id}/ | QWallPartNumberDetailView | IsAuthenticated |
| GET, POST | inspection-points/ | QWallInspectionPointsView | IsAuthenticated |
| PATCH, DELETE | inspection-points/{point_id}/ | QWallInspectionPointDetailView | IsAuthenticated |
| GET, POST | fail-modes/ | QWallFailModesView | IsAuthenticated |
| PATCH, DELETE | fail-modes/{fail_mode_id}/ | QWallFailModeDetailView | IsAuthenticated |
| POST | fail-modes/{fail_mode_id}/assign-points/ | QWallFailModeAssignPointsView | IsAuthenticated |
| GET | system-config/ | QWallSystemConfigView | IsAuthenticated |
| PATCH | system-config/{config_key}/ | QWallSystemConfigDetailView | IsAuthenticated |
| GET | fail-mode-translations/ | QWallFailModeTranslationsView | IsAuthenticated |
| GET | fail-mode-translations/missing/ | QWallFailModeTranslationsMissingView | IsAuthenticated |
| PUT | fail-mode-translations/{fail_mode_code}/ | QWallFailModeTranslationDetailView | IsAuthenticated |
| GET, PUT | pass-rate-target/ | QWallPassRateTargetView | IsAuthenticated |

## 14. Scan rules

Base path: api/v1/quality/scan-rules

| Method | Path | View | Access |
|---|---|---|---|
| GET, POST | / | ScanRuleListCreateView | IsAuthenticated |
| GET | pn-lookup/ | PartNumberLookupView | IsAuthenticated |
| GET, PATCH, DELETE | {id}/ | ScanRuleDetailView | IsAuthenticated |
| PATCH | {id}/toggle/ | ScanRuleToggleView | IsAuthenticated |

## 15. Quality deterministic chatbot support

Base path: api/v1/quality/chatbot

| Method | Path | View | Access |
|---|---|---|---|
| GET | preloaded/ | ChatbotPreloadedView | IsAuthenticated |
| POST | feedback/ | ChatbotFeedbackCreateView | IsAuthenticated |
| POST | suggestion/ | ChatbotSuggestionCreateView | IsAuthenticated |

The repository implementation is template-driven and service-method-driven. It should not be described as a general LLM endpoint solely from this route surface.

## 16. Common API

Base path: api/v1/common

| Method | Path | View | Access |
|---|---|---|---|
| GET | filter-choices/ | FilterChoicesView | IsAuthenticated |

## 17. Empty or structural API namespaces

The root URL configuration registers manufacturing and analytics URL modules. Their reviewed URL files do not currently expose functional route definitions.

These namespaces are present structurally but should not be treated as implemented business APIs.

## 18. API catalog boundary

This document records URL wiring, methods and high-level access controls. Request schemas, query parameters, response contracts, status codes and error contracts will be documented in module-specific API sections because those details are implemented inside views and serializers rather than declared centrally.
