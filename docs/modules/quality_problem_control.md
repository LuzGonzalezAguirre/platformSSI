# Problem Control

## 1. Scope

Problem Control is a PostgreSQL-backed quality workflow for problem registration, team assignment, containment, root-cause analysis, corrective actions, verification, prevention, approvals, attachments, notes, SLA tracking and closure.

The implementation resembles an 8D-oriented workflow and persists workflow state directly in PlatformSSI.

## 2. Primary aggregate

Problem is the central entity.

It stores customer and supplier context, problem description, category and type, severity, part and workcenter context, affected quantities, building, champion, team, initial-response fields, D3 through D8 completion timestamps, FMEA and Control Plan responsibilities, SLA settings, approval assignments, override state and audit timestamps.

## 3. Team structure

A Problem contains one champion and a many-to-many team-member relationship.

ProblemService includes quality-access and quality-role checks used to scope access to problem records.

## 4. D3 containment

ContainmentAction stores containment actions with add date, due date, completion date, ongoing status, action text, response and responsible user.

The API provides list, create, update and delete operations.

## 5. D4 root-cause analysis

FiveWhyAnalysis stores five levels of why analysis by category.

RootCause stores one or more root-cause rows related to a FiveWhyAnalysis and contains why values, corrective-action text and final selection state.

## 6. Corrective, verification and prevention actions

Problem Control has dedicated CorrectiveAction, VerificationAction and PreventionAction models.

These are separate from the Maintenance CorrectiveAction model.

Each action type supports responsible-user assignment and date tracking.

## 7. Problem workflow service

ProblemService provides problem listing, access-scoped retrieval, creation, update, submission for approval, approval, rejection, closure, override request, override approval and deletion.

The service also provides severity, defect-type, quality-user and quality-manager lookup functions.

## 8. Approval model

The Problem entity contains general approval information plus manufacturing, production and maintenance approver relationships and corresponding approval timestamps.

Additional approval view modules implement assigned final approvals and current-user approval assignments.

Submission for final approval is implemented in a dedicated view module.

## 9. Rejection and reopening behavior

The current workflow contains explicit reject operations in the service and API.

The precise state-transition rules are implemented in ProblemService and approval views and should be treated as application logic rather than inferred only from the Problem.status field.

## 10. Override workflow

Problem records support override_requested, override_approved_by, override_approved_at and override_reason.

The API provides separate override request and approval operations.

## 11. SLA behavior

The Problem model stores SLA values for D3 through D8.

SLA-related service code exists separately in quality/services/sla_service.py.

The repository also stores holidays, which can participate in date-based workflow calculations.

## 12. Attachments

Problem attachments have dedicated upload, listing and deletion API endpoints.

Attachment metadata and storage behavior are implemented through the quality attachment model and serializer/view path.

## 13. Notes

Problem notes are managed through dedicated list/create and update/delete endpoints.

## 14. Auditing

Problem Control maintains ProblemAudit in addition to the generic application AuditLog.

ProblemService calls an internal audit creation method for domain-level workflow changes.

## 15. Configurable catalogs

Problem Control contains configurable problem categories, problem types, defect types, severity levels and ProblemControlSettings.

ProblemControlSettings includes the configured quality manager.

## 16. Notifications

NotificationService includes Problem Control notification behavior.

Team assignment and action assignment notifications use deterministic event_key values to avoid duplicate notification rows for the same logical assignment event.

Action notifications can be resolved separately from being marked read.

## 17. Frontend routes

| Route | Function |
|---|---|
| /quality/problems | Problem list |
| /quality/problems/new | Problem creation wizard |
| /quality/problems/{id} | Problem detail |
| /quality/problems/{id}/edit | Problem editing |
| /quality/problems/{id}/approval | Approval view |

## 18. Data ownership

Problem Control is primarily PlatformSSI-owned PostgreSQL state.

External customer, part or workcenter information may be selected or referenced from other integration data, but the workflow record itself is persisted locally.
