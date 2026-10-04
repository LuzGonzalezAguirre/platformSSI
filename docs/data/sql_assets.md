# SQL Assets and Non-Django Database Objects

## 1. Scope

PlatformSSI contains SQL files that define or reconcile database objects outside the normal Django migration path.

These files are part of the deployed system and must be treated as technical assets rather than incidental scripts.

## 2. PostgreSQL reconciliation script

File: ops/db/2026-08-05_prod_reconcile.sql

The script reconciles production safety schema state in PostgreSQL.

Confirmed operations include removal and recreation of the unique employee_id constraint, creation of production_safety_counter_event, removal of the previous days_without_incident column, addition of baseline_date, creation of indexes and creation of foreign-key constraints to user, incident and safety-settings entities.

The script represents direct database reconciliation. It is separate from the ordinary Django migration mechanism and therefore needs to be considered when reproducing historical schema state.

## 3. SQL Server maintenance offender staging

File: scripts/sql/ssi_MaintenanceOffenderActions.sql

The script creates dbo.ssi_MaintenanceOffenderActions when the table does not already exist.

The primary key is SourceKey, a fixed-length 64-character value used to identify the staged source record.

The table stores workweek boundaries, equipment identifiers, description, physical area, department, maintenance hours, work-request count, ranking, processing status, attempt count, generated Action Tracker code, last error, creation time and processed time.

ProcessingStatus is constrained to pending, created or error.

RankNo is constrained to values 1 through 3.

Indexes support pending-record retrieval and equipment/status lookup.

This table acts as an integration staging boundary between PlatformSSI maintenance offender calculation and Action Tracker processing.

## 4. SQL Server Q-Wall lot sampling configuration

File: scripts/sql/ssi_QWallLotSampling.sql

The script operates against the CCS database.

It runs inside an explicit transaction with XACT_ABORT enabled.

The script is designed to be rerunnable without replacing existing business-unit or model choices and without overwriting already populated sampling-matrix cells.

### 4.1 dbo.ssi_QWallLotSettings

Stores one general configuration row per business unit.

Relevant fields include business-unit identifier, configuration mode, general lot size, inspection index, enabled flag and update timestamp.

Mode is constrained to GENERAL or BY_MODEL.

Business unit is unique.

### 4.2 dbo.ssi_QWallLotModelSettings

Stores lot-size overrides by part number for a business-unit configuration.

The combination of setting and part number is unique.

The setting foreign key uses cascading delete.

### 4.3 dbo.ssi_QWallSamplingMatrix

Stores lot ranges, inspection indexes and sample sizes.

A null sample size represents full-lot inspection according to the script comments.

The combination of lot_min and inspection_index is unique.

The script inserts a predefined matrix only for cells that do not already exist.

The matrix deliberately leaves a discontinuity before the final open-ended range rather than inventing a missing range.

## 5. Django migration interaction

Quality migration 0008 previously created PostgreSQL lot-sampling models.

Quality migration 0009 removed those models.

The current SQL Server script therefore represents the active persistence design for Q-Wall lot-sampling configuration.

## 6. Schema ownership

PostgreSQL schema changes normally belong to Django migrations, with the reconciliation file representing an exceptional direct SQL correction.

SQL Server operational tables and integration staging tables are not managed through Django migrations in the current repository.

The physical SQL Server schema is partially represented through scripts and proxy queries, but a complete authoritative schema requires SQL Server metadata inspection.
