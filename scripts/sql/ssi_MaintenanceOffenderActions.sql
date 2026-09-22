IF OBJECT_ID('dbo.ssi_MaintenanceOffenderActions', 'U') IS NULL
BEGIN
    CREATE TABLE dbo.ssi_MaintenanceOffenderActions (
        SourceKey CHAR(64) NOT NULL PRIMARY KEY,
        WeekStart DATE NOT NULL,
        WeekEnd DATE NOT NULL,

        EquipmentId NVARCHAR(100) NOT NULL,
        EquipmentDescription NVARCHAR(250) NULL,
        LineName NVARCHAR(150) NOT NULL,
        Department NVARCHAR(150) NULL,

        MaintenanceHours DECIMAL(18, 4) NOT NULL,
        WorkRequestCount INT NOT NULL,
        RankNo INT NOT NULL CHECK (RankNo BETWEEN 1 AND 3),

        ProcessingStatus VARCHAR(20) NOT NULL DEFAULT 'pending'
            CHECK (ProcessingStatus IN ('pending', 'created', 'error')),
        Attempts INT NOT NULL DEFAULT 0,
        TrackerCode NVARCHAR(40) NULL,
        LastError NVARCHAR(1000) NULL,

        CreatedAt DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
        ProcessedAt DATETIME2 NULL
    );

    CREATE INDEX IX_ssi_MaintenanceOffenderActions_Pending
        ON dbo.ssi_MaintenanceOffenderActions (ProcessingStatus, WeekStart);

    CREATE INDEX IX_ssi_MaintenanceOffenderActions_Equipment
        ON dbo.ssi_MaintenanceOffenderActions (EquipmentId, ProcessingStatus, ProcessedAt);
END;
