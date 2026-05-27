-- ============================================================
-- SSI Attendance Module - Table & Index Creation
-- Database: CCS (AAS-PAC-FTP01)
-- ============================================================

IF NOT EXISTS (
    SELECT 1 FROM INFORMATION_SCHEMA.TABLES
    WHERE TABLE_NAME = 'ssi_Attendance'
)
BEGIN
    CREATE TABLE ssi_Attendance (
        attendance_id   BIGINT IDENTITY(1,1) PRIMARY KEY,
        employee_id     BIGINT          NOT NULL,
        attendance_date DATE            NOT NULL,
        check_in        DATETIME        NULL,
        check_out       DATETIME        NULL,
        turno           CHAR(1)         NOT NULL,   -- 'A' o 'B'

        -- Horas: Turno A = 12h, Turno B = 11h; extras siempre 8h
        regular_hours   DECIMAL(5,2)    NULL,
        overtime_hours  DECIMAL(5,2)    NULL,
        total_hours     AS (ISNULL(regular_hours, 0) + ISNULL(overtime_hours, 0)),

        -- Estado: 'Presente', 'Ausente', 'Retardo', 'Falta'
        status          NVARCHAR(20)    NULL,
        notes           NVARCHAR(500)   NULL,

        created_at      DATETIME        DEFAULT GETDATE(),
        updated_at      DATETIME        DEFAULT GETDATE(),

        CONSTRAINT FK_Attendance_Employee
            FOREIGN KEY (employee_id)
            REFERENCES ssi_production_employee(id),

        CONSTRAINT UQ_Attendance_Employee_Date
            UNIQUE (employee_id, attendance_date)
    );

    CREATE INDEX IX_Attendance_Date     ON ssi_Attendance(attendance_date);
    CREATE INDEX IX_Attendance_Employee ON ssi_Attendance(employee_id);
    CREATE INDEX IX_Attendance_Turno    ON ssi_Attendance(turno);

    PRINT 'Tabla ssi_Attendance creada correctamente.';
END
ELSE
    PRINT 'La tabla ssi_Attendance ya existe.';
