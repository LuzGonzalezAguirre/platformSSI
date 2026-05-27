-- ============================================================
-- SSI Attendance Module - Stored Procedures
-- Database: CCS (AAS-PAC-FTP01)
-- ============================================================

-- ─── sp_RegisterCheckIn ───────────────────────────────────────────────────────
IF OBJECT_ID('sp_RegisterCheckIn', 'P') IS NOT NULL DROP PROCEDURE sp_RegisterCheckIn;
GO
CREATE PROCEDURE sp_RegisterCheckIn
    @barcode_id    NVARCHAR(50),
    @check_in_time DATETIME
AS
BEGIN
    SET NOCOUNT ON;
    DECLARE @employee_id BIGINT;
    DECLARE @turno CHAR(1);
    DECLARE @today DATE = CAST(@check_in_time AS DATE);

    SELECT @employee_id = id, @turno = turno
    FROM ssi_production_employee
    WHERE barcode_id = @barcode_id AND is_active = 1;

    IF @employee_id IS NULL
    BEGIN
        RAISERROR('Empleado no encontrado o inactivo: %s', 16, 1, @barcode_id);
        RETURN;
    END

    -- Detectar retardo (entrada después de las 07:00)
    DECLARE @is_late BIT = 0;
    IF DATEPART(HOUR, @check_in_time) >= 7 AND DATEPART(MINUTE, @check_in_time) > 0
        SET @is_late = 1;

    IF EXISTS (
        SELECT 1 FROM ssi_Attendance
        WHERE employee_id = @employee_id AND attendance_date = @today
    )
    BEGIN
        UPDATE ssi_Attendance
        SET check_in   = @check_in_time,
            status     = CASE WHEN @is_late = 1 THEN 'Retardo' ELSE 'Presente' END,
            updated_at = GETDATE()
        WHERE employee_id = @employee_id AND attendance_date = @today;
    END
    ELSE
    BEGIN
        INSERT INTO ssi_Attendance (employee_id, attendance_date, check_in, turno, status)
        VALUES (
            @employee_id, @today, @check_in_time, @turno,
            CASE WHEN @is_late = 1 THEN 'Retardo' ELSE 'Presente' END
        );
    END

    SELECT
        'Check-in registrado' AS message,
        @employee_id          AS employee_id,
        @turno                AS turno,
        @today                AS attendance_date;
END;
GO

-- ─── sp_RegisterCheckOut ──────────────────────────────────────────────────────
IF OBJECT_ID('sp_RegisterCheckOut', 'P') IS NOT NULL DROP PROCEDURE sp_RegisterCheckOut;
GO
CREATE PROCEDURE sp_RegisterCheckOut
    @barcode_id     NVARCHAR(50),
    @check_out_time DATETIME
AS
BEGIN
    SET NOCOUNT ON;
    DECLARE @employee_id BIGINT;
    DECLARE @turno CHAR(1);
    DECLARE @today DATE = CAST(@check_out_time AS DATE);

    SELECT @employee_id = id, @turno = turno
    FROM ssi_production_employee
    WHERE barcode_id = @barcode_id AND is_active = 1;

    IF @employee_id IS NULL
    BEGIN
        RAISERROR('Empleado no encontrado o inactivo: %s', 16, 1, @barcode_id);
        RETURN;
    END

    UPDATE ssi_Attendance
    SET check_out     = @check_out_time,
        regular_hours = CASE WHEN @turno = 'A' THEN 12.0 ELSE 11.0 END,
        status        = CASE
                            WHEN status = 'Retardo' THEN 'Retardo'
                            ELSE 'Presente'
                        END,
        updated_at    = GETDATE()
    WHERE employee_id = @employee_id AND attendance_date = @today;

    IF @@ROWCOUNT = 0
    BEGIN
        RAISERROR('No hay check-in previo para este empleado hoy.', 16, 1);
        RETURN;
    END

    SELECT
        'Check-out registrado' AS message,
        @employee_id           AS employee_id,
        CASE WHEN @turno = 'A' THEN 12.0 ELSE 11.0 END AS regular_hours;
END;
GO

-- ─── sp_RegisterOvertime ──────────────────────────────────────────────────────
IF OBJECT_ID('sp_RegisterOvertime', 'P') IS NOT NULL DROP PROCEDURE sp_RegisterOvertime;
GO
CREATE PROCEDURE sp_RegisterOvertime
    @employee_id    BIGINT,
    @overtime_date  DATE
AS
BEGIN
    SET NOCOUNT ON;

    UPDATE ssi_Attendance
    SET overtime_hours = 8.0,
        updated_at     = GETDATE()
    WHERE employee_id = @employee_id AND attendance_date = @overtime_date;

    IF @@ROWCOUNT = 0
        RAISERROR('No se encontró registro de asistencia para esa fecha.', 16, 1);
    ELSE
        SELECT 'Horas extras registradas: 8 horas' AS message;
END;
GO

-- ─── sp_GetAttendanceSummary ──────────────────────────────────────────────────
IF OBJECT_ID('sp_GetAttendanceSummary', 'P') IS NOT NULL DROP PROCEDURE sp_GetAttendanceSummary;
GO
CREATE PROCEDURE sp_GetAttendanceSummary
    @start_date DATE,
    @end_date   DATE,
    @turno      CHAR(1) = NULL,
    @department NVARCHAR(100) = NULL,
    @employee_id BIGINT = NULL
AS
BEGIN
    SET NOCOUNT ON;
    SELECT
        a.attendance_id,
        a.attendance_date,
        a.check_in,
        a.check_out,
        a.turno,
        a.regular_hours,
        a.overtime_hours,
        a.total_hours,
        a.status,
        a.notes,
        e.barcode_id,
        e.name    AS employee_name,
        e.department
    FROM ssi_Attendance a
    INNER JOIN ssi_production_employee e ON a.employee_id = e.id
    WHERE a.attendance_date BETWEEN @start_date AND @end_date
        AND (@turno      IS NULL OR a.turno        = @turno)
        AND (@department IS NULL OR e.department   = @department)
        AND (@employee_id IS NULL OR a.employee_id = @employee_id)
    ORDER BY a.attendance_date DESC, e.name;
END;
GO
