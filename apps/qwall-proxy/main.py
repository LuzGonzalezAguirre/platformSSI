# apps/qwall-proxy/main.py

import os
import base64
import pyodbc
import traceback
from fastapi import FastAPI, HTTPException, Depends
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from pydantic import BaseModel

from scan_rules_router import router as scan_rules_router

app    = FastAPI()
bearer = HTTPBearer()


TOKEN    = os.getenv("QWALL_PROXY_TOKEN", "7a31cd3e242533dfc1b2962b1d84c47ddb3065e2752654c7f23b2e06f3dd988e")
CONN_STR = "DRIVER={ODBC Driver 17 for SQL Server};SERVER=AAS-PAC-FTP01;DATABASE=CCS;Trusted_Connection=yes;"


def verify(creds: HTTPAuthorizationCredentials = Depends(bearer)):
    if creds.credentials != TOKEN:
        raise HTTPException(status_code=401, detail="Unauthorized")


def get_conn():
    return pyodbc.connect(CONN_STR, timeout=10)


app.include_router(scan_rules_router, prefix="/scan-rules", tags=["Scan Rules"])


@app.get("/health")
def health():
    return {"status": "ok"}


# ── Models ────────────────────────────────────────────────────────────────────

class DateRange(BaseModel):
    start_date: str
    end_date:   str


class RejectionReportBody(BaseModel):
    start_date: str
    end_date:   str
    bu_id:      int | None = None


# ── Endpoints ─────────────────────────────────────────────────────────────────

@app.post("/inspections", dependencies=[Depends(verify)])
def get_inspections(body: DateRange):
    query = """
    SELECT
        i.inspection_id,
        p.frameSN                                       AS serial_ssi,
        p.fpcaSN                                        AS serial_volvo,
        p.workOrder                                     AS work_order,
        pn.ssiPN                                        AS part_number,
        u.name                                          AS inspector,
        CASE i.inspection_type
            WHEN 1 THEN 'Inspection 1'
            WHEN 2 THEN 'Inspection 2'
            WHEN 3 THEN 'Inspection 3'
        END                                             AS inspection_type,
        CASE i.overall_result
            WHEN 1 THEN 'PASS'
            WHEN 0 THEN 'FAIL'
        END                                             AS result,
        ISNULL(
            STUFF((
                SELECT ', ' + fm2.description
                FROM ssi_InspectionResults ir2
                INNER JOIN ssi_ResultFailModes rfm2 ON ir2.result_id     = rfm2.result_id
                INNER JOIN ssi_FailModes       fm2  ON rfm2.fail_mode_id = fm2.fail_mode_id
                WHERE ir2.inspection_id = i.inspection_id
                FOR XML PATH(''), TYPE
            ).value('.', 'NVARCHAR(MAX)'), 1, 2, '')
        , '')                                           AS fail_modes,
        CAST(i.started_at  AS DATE)                     AS inspection_date,
        CONVERT(VARCHAR(8), i.started_at,  108)         AS time_start,
        CONVERT(VARCHAR(8), i.finished_at, 108)         AS time_end,
        DATEDIFF(SECOND, i.started_at, i.finished_at)   AS duration_seconds,
        DATEPART(WEEK, i.started_at)                    AS week_number,
        DATENAME(MONTH, i.started_at)                   AS month_name
    FROM ssi_Inspections   i
    INNER JOIN ssi_Products    p   ON i.product_id = p.product_id
    INNER JOIN ssi_PartNumbers pn  ON p.pn_id      = pn.pn_id
    INNER JOIN ssi_Users       u   ON i.user_id    = u.user_id
    WHERE CAST(i.started_at AS DATE) BETWEEN ? AND ?
    ORDER BY i.started_at DESC
    """
    try:
        conn   = get_conn()
        cursor = conn.cursor()
        cursor.execute(query, body.start_date, body.end_date)
        columns = [col[0] for col in cursor.description]
        rows    = [dict(zip(columns, row)) for row in cursor.fetchall()]
        conn.close()
        for r in rows:
            if hasattr(r.get("inspection_date"), "isoformat"):
                r["inspection_date"] = r["inspection_date"].isoformat()
        return {"data": rows}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/rejection-report", dependencies=[Depends(verify)])
def rejection_report(body: RejectionReportBody):
    bu_filter = f"AND ip.bu_id = {int(body.bu_id)}" if body.bu_id else ""

    sql = f"""
        SELECT
            ir.result_id,
            ir.inspection_id,
            i.started_at,
            ip.inspection_point_id,
            ip.point_name,
            ip.bu_id,
            bu.bu_name,
            fm.fail_mode_id,
            fm.fail_code,
            fm.description      AS fail_description,
            p.volvoSerialNumber AS serial_number,
            p.frameSN,
            p.fpcaSN,
            p.workOrder,
            u.name              AS inspector_name,
            CASE WHEN rp.photo_id IS NOT NULL THEN 1 ELSE 0 END AS has_photo
        FROM ssi_InspectionResults ir
        INNER JOIN ssi_Inspections i
            ON ir.inspection_id = i.inspection_id
        INNER JOIN ssi_InspectionPoints ip
            ON ir.inspection_point_id = ip.inspection_point_id
        INNER JOIN ssi_BusinessUnits bu
            ON ip.bu_id = bu.bu_id
        INNER JOIN ssi_ResultFailModes rfm
            ON ir.result_id = rfm.result_id
        INNER JOIN ssi_FailModes fm
            ON rfm.fail_mode_id = fm.fail_mode_id
        INNER JOIN ssi_Products p
            ON i.product_id = p.product_id
        INNER JOIN ssi_Users u
            ON i.user_id = u.user_id
        LEFT JOIN ssi_RejectionPhotos rp
            ON i.inspection_id = rp.inspection_id
        WHERE ir.status = 0
          AND CAST(i.started_at AS DATE) BETWEEN ? AND ?
          {bu_filter}
        ORDER BY fm.description, p.volvoSerialNumber, i.started_at DESC
    """
    import traceback  # agregar
    try:
        conn   = get_conn()
        cursor = conn.cursor()
        cursor.execute(sql, body.start_date, body.end_date)
        cols = [d[0] for d in cursor.description]
        rows = [dict(zip(cols, row)) for row in cursor.fetchall()]
        conn.close()
        for r in rows:
            if r.get("started_at") and hasattr(r["started_at"], "isoformat"):
                r["started_at"] = r["started_at"].isoformat()
        return {"data": rows}
    except Exception:
        tb = traceback.format_exc()
        print(tb)
        raise HTTPException(status_code=500, detail=tb)
@app.get("/rejection-photo/{inspection_id}", dependencies=[Depends(verify)])
def rejection_photo(inspection_id: int):
    try:
        conn   = get_conn()
        cursor = conn.cursor()
        cursor.execute(
            "SELECT photo_data, taken_at FROM ssi_RejectionPhotos WHERE inspection_id = ?",
            inspection_id,
        )
        row = cursor.fetchone()
        conn.close()
        if not row:
            raise HTTPException(status_code=404, detail="No photo found")
        photo_b64 = base64.b64encode(bytes(row[0])).decode("utf-8")
        taken_at  = row[1].isoformat() if row[1] else None
        return {"photo_b64": photo_b64, "taken_at": taken_at}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
    
# apps/qwall-proxy/main.py — agregar

@app.get("/part-numbers", dependencies=[Depends(verify)])
def get_part_numbers():
    sql = """
        SELECT pn.pn_id, pn.ssiPN, pn.volvoProductNumber, bu.bu_name
        FROM ssi_PartNumbers pn
        INNER JOIN ssi_BusinessUnits bu ON pn.bu_id = bu.bu_id
        ORDER BY bu.bu_name, pn.ssiPN
    """
    try:
        conn   = get_conn()
        cursor = conn.cursor()
        cursor.execute(sql)
        cols = [d[0] for d in cursor.description]
        rows = [dict(zip(cols, row)) for row in cursor.fetchall()]
        conn.close()
        return {"data": rows}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# ══════════════════════════════════════════════════════════════════════════════
# ASISTENCIA DIARIA MANUAL — Grilla de presentes/ausentes
# ══════════════════════════════════════════════════════════════════════════════

class AttendanceDailyRecord(BaseModel):
    employee_id: int
    date:        str
    turno:       str
    status:      str   # present / absent / leave / sick
    shift:       str   # full / partial / overtime / none
    hours:       float


class AttendanceDailyBulk(BaseModel):
    records: list[AttendanceDailyRecord]


def _infer_shift(hours: float, turno: str, status: str) -> str:
    if status in ("absent", "Ausente") or hours == 0:
        return "none"
    full_h = 11.0 if turno == "B" else 12.0
    if hours >= full_h:
        return "full"
    if hours >= 8:
        return "overtime"
    return "partial"


@app.get("/attendance/daily", dependencies=[Depends(verify)])
def get_attendance_daily(date: str, turno: str | None = None):
    try:
        conn = get_conn(); c = conn.cursor()

        # 1. Employees
        emp_params: list = []
        turno_clause = ""
        if turno:
            turno_clause = " AND turno = ?"
            emp_params.append(turno)
        c.execute(
            f"SELECT id, name, turno, department, barcode_id FROM ssi_production_employee WHERE is_active = 1{turno_clause} ORDER BY turno, name",
            emp_params,
        )
        employees = _rows_to_dicts(c)

        # 2. Existing attendance records (fail-safe: table may not exist yet)
        att_map: dict = {}
        try:
            c.execute(
                """
                SELECT attendance_id, employee_id, status, total_hours
                FROM   ssi_Attendance
                WHERE  attendance_date = CAST(? AS DATE)
                  AND  check_in IS NULL
                """,
                date,
            )
            for row in _rows_to_dicts(c):
                att_map[row["employee_id"]] = row
        except Exception:
            pass  # table doesn't exist — return defaults

        conn.close()

        result = []
        for e in employees:
            turno_val = e["turno"]
            default_h = 11.0 if turno_val == "B" else 12.0
            saved     = att_map.get(e["id"])
            status    = saved["status"] if saved else "present"
            hours     = float(saved["total_hours"]) if saved and saved["total_hours"] is not None else (0.0 if status == "absent" else default_h)
            result.append({
                "id":            saved["attendance_id"] if saved else None,
                "employee_id":   e["id"],
                "employee_name": e["name"],
                "turno":         turno_val,
                "date":          date,
                "status":        status,
                "shift":         _infer_shift(hours, turno_val, status),
                "hours":         str(hours),
                "recorded_at":   None,
            })
        return result
    except Exception as e:
        tb = traceback.format_exc(); print(tb)
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/attendance/daily", dependencies=[Depends(verify)])
def save_attendance_daily(body: AttendanceDailyBulk):
    try:
        conn = get_conn(); c = conn.cursor()
        saved = 0
        for r in body.records:
            h = 0.0 if r.status in ("absent",) else r.hours
            c.execute("""
                MERGE ssi_Attendance AS target
                USING (SELECT ? AS employee_id, CAST(? AS DATE) AS attendance_date) AS src
                ON  target.employee_id    = src.employee_id
                AND target.attendance_date = src.attendance_date
                AND target.check_in IS NULL
                WHEN MATCHED THEN
                    UPDATE SET status = ?, total_hours = ?, regular_hours = ?
                WHEN NOT MATCHED THEN
                    INSERT (employee_id, attendance_date, turno, status, total_hours, regular_hours, overtime_hours)
                    VALUES (?, CAST(? AS DATE), ?, ?, ?, ?, 0);
            """,
            r.employee_id, r.date,
            r.status, h, h,
            r.employee_id, r.date, r.turno, r.status, h, h,
            )
            saved += 1
        conn.commit(); conn.close()
        return {"saved": saved}
    except Exception as e:
        tb = traceback.format_exc(); print(tb)
        raise HTTPException(status_code=500, detail=str(e))


# ══════════════════════════════════════════════════════════════════════════════
# ASISTENCIA — Check-In / Check-Out / Horas Extras
# ══════════════════════════════════════════════════════════════════════════════

class CheckInBody(BaseModel):
    barcode_id:    str
    check_in_time: str | None = None   # ISO datetime, defaults to now

class CheckOutBody(BaseModel):
    barcode_id:     str
    check_out_time: str | None = None  # ISO datetime, defaults to now

class OvertimeBody(BaseModel):
    employee_id:   int
    overtime_date: str   # YYYY-MM-DD

class AttendanceRecordsBody(BaseModel):
    start_date:  str
    end_date:    str
    turno:       str | None = None
    department:  str | None = None
    employee_id: int | None = None


def _rows_to_dicts(cursor) -> list[dict]:
    if cursor.description is None:
        return []
    cols = [d[0] for d in cursor.description]
    rows = []
    for row in cursor.fetchall():
        r = dict(zip(cols, row))
        for k, v in r.items():
            if hasattr(v, "isoformat"):
                r[k] = v.isoformat()
        rows.append(r)
    return rows


@app.post("/attendance/check-in", dependencies=[Depends(verify)])
def attendance_check_in(body: CheckInBody):
    from datetime import datetime
    try:
        conn      = get_conn()
        cursor    = conn.cursor()
        check_time = body.check_in_time or datetime.now().strftime("%Y-%m-%dT%H:%M:%S")
        cursor.execute("EXEC sp_RegisterCheckIn ?, ?", body.barcode_id, check_time)
        result = _rows_to_dicts(cursor)
        conn.commit()
        conn.close()
        return {"success": True, "data": result[0] if result else {}}
    except Exception as e:
        tb = traceback.format_exc()
        print(tb)
        raise HTTPException(status_code=400, detail=str(e))


@app.post("/attendance/check-out", dependencies=[Depends(verify)])
def attendance_check_out(body: CheckOutBody):
    from datetime import datetime
    try:
        conn      = get_conn()
        cursor    = conn.cursor()
        check_time = body.check_out_time or datetime.now().strftime("%Y-%m-%dT%H:%M:%S")
        cursor.execute("EXEC sp_RegisterCheckOut ?, ?", body.barcode_id, check_time)
        result = _rows_to_dicts(cursor)
        conn.commit()
        conn.close()
        return {"success": True, "data": result[0] if result else {}}
    except Exception as e:
        tb = traceback.format_exc()
        print(tb)
        raise HTTPException(status_code=400, detail=str(e))


@app.post("/attendance/overtime", dependencies=[Depends(verify)])
def attendance_overtime(body: OvertimeBody):
    try:
        conn   = get_conn()
        cursor = conn.cursor()
        cursor.execute("EXEC sp_RegisterOvertime ?, ?", body.employee_id, body.overtime_date)
        result = _rows_to_dicts(cursor)
        conn.commit()
        conn.close()
        return {"success": True, "data": result[0] if result else {}}
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@app.get("/attendance/today-status", dependencies=[Depends(verify)])
def attendance_today_status(barcode_id: str):
    try:
        conn   = get_conn()
        cursor = conn.cursor()
        cursor.execute("""
            SELECT a.attendance_id, a.attendance_date, a.check_in, a.check_out,
                   a.turno, a.regular_hours, a.overtime_hours, a.total_hours, a.status,
                   e.name AS employee_name, e.barcode_id, e.department
            FROM ssi_Attendance a
            INNER JOIN ssi_production_employee e ON a.employee_id = e.id
            WHERE e.barcode_id = ? AND a.attendance_date = CAST(GETDATE() AS DATE)
        """, barcode_id)
        rows = _rows_to_dicts(cursor)
        if rows:
            conn.close()
            return {"found": True, **rows[0]}
        cursor.execute(
            "SELECT id, name, department, turno FROM ssi_production_employee WHERE barcode_id = ? AND is_active = 1",
            barcode_id,
        )
        emp_rows = _rows_to_dicts(cursor)
        conn.close()
        return {"found": False, "employee": emp_rows[0] if emp_rows else None}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/attendance/records", dependencies=[Depends(verify)])
def attendance_records(body: AttendanceRecordsBody):
    try:
        conn   = get_conn()
        cursor = conn.cursor()
        cursor.execute(
            "EXEC sp_GetAttendanceSummary ?, ?, ?, ?, ?",
            body.start_date, body.end_date, body.turno, body.department, body.employee_id,
        )
        rows = _rows_to_dicts(cursor)
        conn.close()
        return {"data": rows, "total": len(rows)}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/attendance/kpis", dependencies=[Depends(verify)])
def attendance_kpis(body: AttendanceRecordsBody):
    try:
        conn = get_conn()
        c    = conn.cursor()
        c.execute("""
            SELECT COUNT(*) FROM ssi_Attendance a
            INNER JOIN ssi_production_employee e ON a.employee_id = e.id
            WHERE a.attendance_date = CAST(GETDATE() AS DATE) AND a.status IN ('Presente','Retardo')
        """)
        present_today = c.fetchone()[0]
        filters = ["a.attendance_date BETWEEN ? AND ?"]
        params  = [body.start_date, body.end_date]
        if body.turno:     filters.append("a.turno = ?");      params.append(body.turno)
        if body.department: filters.append("e.department = ?"); params.append(body.department)
        where = " AND ".join(filters)
        c.execute(f"SELECT COUNT(*) FROM ssi_Attendance a INNER JOIN ssi_production_employee e ON a.employee_id=e.id WHERE a.status='Ausente' AND {where}", params)
        total_absences = c.fetchone()[0]
        c.execute(f"SELECT COUNT(*) FROM ssi_Attendance a INNER JOIN ssi_production_employee e ON a.employee_id=e.id WHERE a.status='Retardo' AND {where}", params)
        total_delays = c.fetchone()[0]
        c.execute(f"SELECT SUM(ISNULL(a.regular_hours,0)), SUM(ISNULL(a.overtime_hours,0)), SUM(a.total_hours) FROM ssi_Attendance a INNER JOIN ssi_production_employee e ON a.employee_id=e.id WHERE {where}", params)
        row = c.fetchone()
        conn.close()
        return {"present_today": present_today, "total_absences": total_absences,
                "total_delays": total_delays, "total_regular_hours": float(row[0] or 0),
                "total_overtime_hours": float(row[1] or 0), "grand_total_hours": float(row[2] or 0)}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/attendance/employees", dependencies=[Depends(verify)])
def attendance_employees(department: str | None = None, include_inactive: bool = False):
    try:
        conn   = get_conn()
        cursor = conn.cursor()
        sql    = "SELECT id, barcode_id, name, department, turno, is_active, created_at FROM ssi_production_employee WHERE 1=1"
        params: list = []
        if not include_inactive:
            sql += " AND is_active = 1"
        if department:
            sql += " AND department = ?"
            params.append(department)
        sql += " ORDER BY name"
        cursor.execute(sql, params)
        rows = _rows_to_dicts(cursor)
        conn.close()
        return {"data": rows}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


class EmployeeCreateBody(BaseModel):
    name:       str
    department: str
    turno:      str
    barcode_id: str | None = None


class EmployeeUpdateBody(BaseModel):
    name:       str | None = None
    department: str | None = None
    turno:      str | None = None
    barcode_id: str | None = None


@app.post("/attendance/employees", dependencies=[Depends(verify)])
def create_employee(body: EmployeeCreateBody):
    try:
        conn = get_conn(); c = conn.cursor()
        c.execute(
            "INSERT INTO ssi_production_employee (name, department, turno, barcode_id, is_active, created_at) VALUES (?, ?, ?, ?, 1, GETDATE())",
            body.name, body.department, body.turno, body.barcode_id,
        )
        c.execute("SELECT SCOPE_IDENTITY()")
        new_id = int(c.fetchone()[0])
        conn.commit()
        c.execute("SELECT id, barcode_id, name, department, turno, is_active, created_at FROM ssi_production_employee WHERE id = ?", new_id)
        rows = _rows_to_dicts(c)
        conn.close()
        return rows[0] if rows else {}
    except Exception as e:
        tb = traceback.format_exc(); print(tb)
        raise HTTPException(status_code=400, detail=str(e))


@app.patch("/attendance/employees/{employee_id}", dependencies=[Depends(verify)])
def update_employee(employee_id: int, body: EmployeeUpdateBody):
    sets: list[str] = []
    params: list    = []
    if body.name       is not None: sets.append("name = ?");       params.append(body.name)
    if body.department is not None: sets.append("department = ?"); params.append(body.department)
    if body.turno      is not None: sets.append("turno = ?");      params.append(body.turno)
    if body.barcode_id is not None: sets.append("barcode_id = ?"); params.append(body.barcode_id)
    if not sets:
        raise HTTPException(status_code=400, detail="No fields to update")
    try:
        conn = get_conn(); c = conn.cursor()
        c.execute(f"UPDATE ssi_production_employee SET {', '.join(sets)} WHERE id = ?", params + [employee_id])
        conn.commit()
        c.execute("SELECT id, barcode_id, name, department, turno, is_active, created_at FROM ssi_production_employee WHERE id = ?", employee_id)
        rows = _rows_to_dicts(c)
        conn.close()
        if not rows:
            raise HTTPException(status_code=404, detail="Employee not found")
        return rows[0]
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@app.delete("/attendance/employees/{employee_id}", dependencies=[Depends(verify)])
def deactivate_employee(employee_id: int):
    try:
        conn = get_conn(); c = conn.cursor()
        c.execute("UPDATE ssi_production_employee SET is_active = 0 WHERE id = ?", employee_id)
        conn.commit()
        c.execute("SELECT id, barcode_id, name, department, turno, is_active, created_at FROM ssi_production_employee WHERE id = ?", employee_id)
        rows = _rows_to_dicts(c)
        conn.close()
        if not rows:
            raise HTTPException(status_code=404, detail="Employee not found")
        return rows[0]
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


# ══════════════════════════════════════════════════════════════════════════════
# LEY SILLA NOM-036 — Chair Control
# ══════════════════════════════════════════════════════════════════════════════

class ChairKpisBody(BaseModel):
    start_date: str
    end_date:   str
    turno:      str | None = None
    department: str | None = None

class ChairBreaksBody(BaseModel):
    start_date: str
    end_date:   str
    turno:      str | None = None
    department: str | None = None
    search:     str | None = None
    page:       int        = 1
    page_size:  int        = 20
    order_by:   str        = "check_in"
    order_dir:  str        = "DESC"


def _chair_where(body):
    filters = ["cu.check_out IS NOT NULL", "CAST(cu.check_in AS DATE) BETWEEN ? AND ?"]
    params  = [body.start_date, body.end_date]
    if body.turno:      filters.append("e.turno = ?");      params.append(body.turno)
    if body.department: filters.append("e.department = ?"); params.append(body.department)
    return " AND ".join(filters), params


@app.post("/chairs/kpis", dependencies=[Depends(verify)])
def chairs_kpis(body: ChairKpisBody):
    try:
        conn  = get_conn(); c = conn.cursor()
        where, params = _chair_where(body)
        c.execute("SELECT COUNT(*) FROM ssi_ChairUsage WHERE CAST(check_in AS DATE) = CAST(GETDATE() AS DATE)")
        today_breaks = c.fetchone()[0]
        c.execute(f"SELECT COUNT(*) FROM ssi_ChairUsage cu INNER JOIN ssi_production_employee e ON cu.employee_id=e.id WHERE {where}", params)
        total_breaks = c.fetchone()[0]
        c.execute(f"SELECT AVG(CAST(DATEDIFF(MINUTE,cu.check_in,cu.check_out) AS FLOAT)) FROM ssi_ChairUsage cu INNER JOIN ssi_production_employee e ON cu.employee_id=e.id WHERE {where}", params)
        avg_min = c.fetchone()[0] or 0
        c.execute("SELECT COUNT(*) FROM ssi_ChairUsage WHERE check_out IS NULL")
        active_now = c.fetchone()[0]
        c.execute(f"SELECT cu.released_by, COUNT(*) AS total, CAST(COUNT(*)*100.0/SUM(COUNT(*)) OVER() AS DECIMAL(5,2)) AS percentage FROM ssi_ChairUsage cu INNER JOIN ssi_production_employee e ON cu.employee_id=e.id WHERE {where} GROUP BY cu.released_by", params)
        released = _rows_to_dicts(c)
        conn.close()
        auto_pct   = next((r["percentage"] for r in released if r["released_by"] == "Auto"),   0)
        manual_pct = next((r["percentage"] for r in released if r["released_by"] == "Manual"), 0)
        return {"today_breaks": today_breaks, "total_breaks": total_breaks,
                "avg_duration_min": round(avg_min, 1), "active_now": active_now,
                "auto_pct": float(auto_pct), "manual_pct": float(manual_pct),
                "compliance_pct": 0, "released_by_breakdown": released}
    except Exception as e:
        tb = traceback.format_exc(); print(tb)
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/chairs/breaks", dependencies=[Depends(verify)])
def chairs_breaks(body: ChairBreaksBody):
    ALLOWED = {"check_in","check_out","employee_name","barcode_id",
               "turno","chair_number","duration_min","released_by","break_date"}
    order_by  = body.order_by if body.order_by in ALLOWED else "check_in"
    order_dir = "ASC" if body.order_dir.upper() == "ASC" else "DESC"
    base: list[str] = ["cu.check_out IS NOT NULL", "CAST(cu.check_in AS DATE) BETWEEN ? AND ?"]
    params: list = [body.start_date, body.end_date]
    if body.turno:      base.append("e.turno = ?");      params.append(body.turno)
    if body.department: base.append("e.department = ?"); params.append(body.department)
    if body.search:
        base.append("(e.name LIKE ? OR e.barcode_id LIKE ?)")
        params.extend([f"%{body.search}%", f"%{body.search}%"])
    where = " AND ".join(base)
    try:
        conn = get_conn(); c = conn.cursor()
        c.execute(f"SELECT COUNT(*) FROM ssi_ChairUsage cu INNER JOIN ssi_production_employee e ON cu.employee_id=e.id WHERE {where}", params)
        total  = c.fetchone()[0]
        offset = (body.page - 1) * body.page_size
        c.execute(f"""
            SELECT e.barcode_id, e.name AS employee_name, e.turno, e.department,
                   cu.chair_number, cu.check_in, cu.check_out,
                   DATEDIFF(MINUTE,cu.check_in,cu.check_out) AS duration_min,
                   cu.released_by, CAST(cu.check_in AS DATE) AS break_date
            FROM ssi_ChairUsage cu INNER JOIN ssi_production_employee e ON cu.employee_id=e.id
            WHERE {where} ORDER BY {order_by} {order_dir}
            OFFSET ? ROWS FETCH NEXT ? ROWS ONLY
        """, params + [offset, body.page_size])
        rows = _rows_to_dicts(c); conn.close()
        return {"total": total, "page": body.page, "page_size": body.page_size,
                "pages": max(1, -(-total // body.page_size)), "results": rows}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/chairs/daily-chart", dependencies=[Depends(verify)])
def chairs_daily_chart(body: ChairKpisBody):
    where, params = _chair_where(body)
    try:
        conn = get_conn(); c = conn.cursor()
        c.execute(f"""
            SELECT CAST(cu.check_in AS DATE) AS break_date, COUNT(*) AS total_breaks,
                   AVG(CAST(DATEDIFF(MINUTE,cu.check_in,cu.check_out) AS FLOAT)) AS avg_duration
            FROM ssi_ChairUsage cu INNER JOIN ssi_production_employee e ON cu.employee_id=e.id
            WHERE {where} GROUP BY CAST(cu.check_in AS DATE) ORDER BY break_date
        """, params)
        rows = _rows_to_dicts(c); conn.close()
        for r in rows: r["avg_duration"] = round(r.get("avg_duration") or 0, 1)
        return {"data": rows}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/chairs/turno-chart", dependencies=[Depends(verify)])
def chairs_turno_chart(body: ChairKpisBody):
    try:
        conn = get_conn(); c = conn.cursor()
        c.execute("""
            SELECT e.turno, COUNT(*) AS total FROM ssi_ChairUsage cu
            INNER JOIN ssi_production_employee e ON cu.employee_id=e.id
            WHERE cu.check_out IS NOT NULL AND CAST(cu.check_in AS DATE) BETWEEN ? AND ?
            GROUP BY e.turno
        """, body.start_date, body.end_date)
        rows = _rows_to_dicts(c); conn.close()
        return {"data": rows}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# ══════════════════════════════════════════════════════════════════════════════
# CATÁLOGO DE FALLAS — Estructura BU → Puntos de Inspección → Modos de Falla
# ══════════════════════════════════════════════════════════════════════════════

@app.get("/catalog/structure", dependencies=[Depends(verify)])
def catalog_structure():
    try:
        conn = get_conn(); c = conn.cursor()
        c.execute("""
            SELECT
                bu.bu_id,
                bu.bu_name,
                ip.inspection_point_id,
                ip.point_name,
                ip.sequence_order,
                fm.fail_mode_id,
                fm.fail_code,
                fm.description  AS fm_description
            FROM ssi_BusinessUnits bu
            LEFT JOIN ssi_InspectionPoints ip
                ON  ip.bu_id     = bu.bu_id
                AND ip.is_active = 1
            LEFT JOIN ssi_InspectionPointFailModes ipfm
                ON  ipfm.inspection_point_id = ip.inspection_point_id
            LEFT JOIN ssi_FailModes fm
                ON  fm.fail_mode_id = ipfm.fail_mode_id
                AND fm.is_active    = 1
            ORDER BY bu.bu_id, ip.sequence_order, ip.inspection_point_id, fm.fail_mode_id
        """)
        rows = _rows_to_dicts(c); conn.close()
        return {"data": rows}
    except Exception as e:
        tb = traceback.format_exc(); print(tb)
        raise HTTPException(status_code=500, detail=str(e))


# ══════════════════════════════════════════════════════════════════════════════
# QWALL SETTINGS — Configuration CRUD
# ══════════════════════════════════════════════════════════════════════════════

@app.get("/settings/schema-inspect", dependencies=[Depends(verify)])
def settings_schema_inspect():
    tables = ["ssi_Users", "ssi_PartNumbers", "ssi_InspectionPoints", "ssi_FailModes", "ssi_SystemConfig", "ssi_Roles", "ssi_BusinessUnits"]
    result = {}
    try:
        conn = get_conn(); c = conn.cursor()
        for tbl in tables:
            c.execute(f"SELECT TOP 0 * FROM {tbl}")
            result[tbl] = [d[0] for d in c.description]
        conn.close()
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


class UserCreateBody(BaseModel):
    name:          str
    barcode_id:    str
    password_hash: str
    role_id:       int

class UserUpdateBody(BaseModel):
    name:          str | None = None
    barcode_id:    str | None = None
    password_hash: str | None = None
    role_id:       int | None = None
    is_active:     int | None = None

class PartNumberCreateBody(BaseModel):
    ssiPN:             str
    volvoProductNumber: str
    bu_id:             int

class PartNumberUpdateBody(BaseModel):
    ssiPN:             str | None = None
    volvoProductNumber: str | None = None
    bu_id:             int | None = None

class InspectionPointCreateBody(BaseModel):
    point_name:     str
    bu_id:          int
    sequence_order: int

class InspectionPointUpdateBody(BaseModel):
    point_name:     str | None = None
    bu_id:          int | None = None
    sequence_order: int | None = None
    is_active:      int | None = None

class FailModeCreateBody(BaseModel):
    fail_code:   str
    description: str

class FailModeUpdateBody(BaseModel):
    fail_code:   str | None = None
    description: str | None = None
    is_active:   int | None = None

class AssignPointsBody(BaseModel):
    point_ids: list[int]

class SystemConfigUpdateBody(BaseModel):
    value: str


# ── Business Units & Roles (read-only, for dropdowns) ─────────────────────────

@app.get("/settings/business-units", dependencies=[Depends(verify)])
def settings_business_units():
    try:
        conn = get_conn(); c = conn.cursor()
        c.execute("SELECT bu_id, bu_name FROM ssi_BusinessUnits ORDER BY bu_name")
        rows = _rows_to_dicts(c); conn.close()
        return {"data": rows}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/settings/qwall-roles", dependencies=[Depends(verify)])
def settings_qwall_roles():
    try:
        conn = get_conn(); c = conn.cursor()
        c.execute("SELECT role_id, role_name FROM ssi_Roles ORDER BY role_name")
        rows = _rows_to_dicts(c); conn.close()
        return {"data": rows}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# ── Users (no BU filter — inspectors work globally) ───────────────────────────

_USER_SELECT = """
    SELECT u.user_id, u.name, u.barcode_id, u.role_id, r.role_name, u.is_active, u.created_at
    FROM ssi_Users u
    LEFT JOIN ssi_Roles r ON u.role_id = r.role_id
"""


@app.get("/settings/users", dependencies=[Depends(verify)])
def settings_users():
    try:
        conn = get_conn(); c = conn.cursor()
        c.execute(_USER_SELECT + " ORDER BY u.name")
        rows = _rows_to_dicts(c); conn.close()
        return {"data": rows}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/settings/users", dependencies=[Depends(verify)])
def settings_create_user(body: UserCreateBody):
    try:
        conn = get_conn(); c = conn.cursor()
        c.execute(
            """
            INSERT INTO ssi_Users (name, barcode_id, password_hash, role_id, is_active, created_at)
            OUTPUT INSERTED.user_id
            VALUES (?, ?, HASHBYTES('SHA2_256', ?), ?, 1, GETDATE())
            """,
            body.name, body.barcode_id, body.password_hash, body.role_id,
        )
        row = c.fetchone()
        new_id = int(row[0]) if row else None
        conn.commit()
        if new_id is None:
            conn.close()
            raise HTTPException(status_code=500, detail="INSERT did not return a user_id")
        c.execute(_USER_SELECT + " WHERE u.user_id = ?", new_id)
        rows = _rows_to_dicts(c); conn.close()
        return rows[0] if rows else {}
    except HTTPException:
        raise
    except Exception as e:
        tb = traceback.format_exc(); print(tb)
        raise HTTPException(status_code=500, detail=str(e))


@app.patch("/settings/users/{user_id}", dependencies=[Depends(verify)])
def settings_update_user(user_id: int, body: UserUpdateBody):
    sets: list[str] = []; params: list = []
    if body.name          is not None: sets.append("name = ?");                            params.append(body.name)
    if body.barcode_id    is not None: sets.append("barcode_id = ?");                    params.append(body.barcode_id)
    if body.password_hash is not None: sets.append("password_hash = HASHBYTES('SHA2_256', ?)"); params.append(body.password_hash)
    if body.role_id       is not None: sets.append("role_id = ?");                       params.append(body.role_id)
    if body.is_active     is not None: sets.append("is_active = ?");                     params.append(body.is_active)
    if not sets:
        raise HTTPException(status_code=400, detail="No fields to update")
    try:
        conn = get_conn(); c = conn.cursor()
        c.execute(f"UPDATE ssi_Users SET {', '.join(sets)} WHERE user_id = ?", params + [user_id])
        conn.commit()
        c.execute(_USER_SELECT + " WHERE u.user_id = ?", user_id)
        rows = _rows_to_dicts(c); conn.close()
        if not rows:
            raise HTTPException(status_code=404, detail="User not found")
        return rows[0]
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.delete("/settings/users/{user_id}", dependencies=[Depends(verify)])
def settings_deactivate_user(user_id: int):
    try:
        conn = get_conn(); c = conn.cursor()
        c.execute("UPDATE ssi_Users SET is_active = 0 WHERE user_id = ?", user_id)
        conn.commit()
        c.execute(_USER_SELECT + " WHERE u.user_id = ?", user_id)
        rows = _rows_to_dicts(c); conn.close()
        if not rows:
            raise HTTPException(status_code=404, detail="User not found")
        return rows[0]
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# ── Part Numbers ───────────────────────────────────────────────────────────────

_PN_SELECT = """
    SELECT pn.pn_id, pn.ssiPN, pn.volvoProductNumber, pn.bu_id, bu.bu_name
    FROM ssi_PartNumbers pn
    INNER JOIN ssi_BusinessUnits bu ON pn.bu_id = bu.bu_id
"""


@app.get("/settings/part-numbers", dependencies=[Depends(verify)])
def settings_part_numbers(bu_id: int | None = None):
    sql = _PN_SELECT
    params: list = []
    if bu_id is not None:
        sql += " WHERE pn.bu_id = ?"
        params.append(bu_id)
    sql += " ORDER BY bu.bu_name, pn.ssiPN"
    try:
        conn = get_conn(); c = conn.cursor()
        c.execute(sql, params)
        rows = _rows_to_dicts(c); conn.close()
        return {"data": rows}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/settings/part-numbers", dependencies=[Depends(verify)])
def settings_create_part_number(body: PartNumberCreateBody):
    try:
        conn = get_conn(); c = conn.cursor()
        c.execute(
            """
            INSERT INTO ssi_PartNumbers (ssiPN, volvoProductNumber, bu_id)
            OUTPUT INSERTED.pn_id
            VALUES (?, ?, ?)
            """,
            body.ssiPN, body.volvoProductNumber, body.bu_id,
        )
        row = c.fetchone()
        new_id = int(row[0]) if row else None
        conn.commit()
        if new_id is None:
            conn.close(); raise HTTPException(status_code=500, detail="INSERT did not return id")
        c.execute(_PN_SELECT + " WHERE pn.pn_id = ?", new_id)
        rows = _rows_to_dicts(c); conn.close()
        return rows[0] if rows else {}
    except HTTPException:
        raise
    except Exception as e:
        tb = traceback.format_exc(); print(tb)
        raise HTTPException(status_code=500, detail=str(e))


@app.patch("/settings/part-numbers/{pn_id}", dependencies=[Depends(verify)])
def settings_update_part_number(pn_id: int, body: PartNumberUpdateBody):
    sets: list[str] = []; params: list = []
    if body.ssiPN              is not None: sets.append("ssiPN = ?");              params.append(body.ssiPN)
    if body.volvoProductNumber is not None: sets.append("volvoProductNumber = ?"); params.append(body.volvoProductNumber)
    if body.bu_id              is not None: sets.append("bu_id = ?");              params.append(body.bu_id)
    if not sets:
        raise HTTPException(status_code=400, detail="No fields to update")
    try:
        conn = get_conn(); c = conn.cursor()
        c.execute(f"UPDATE ssi_PartNumbers SET {', '.join(sets)} WHERE pn_id = ?", params + [pn_id])
        conn.commit()
        c.execute(_PN_SELECT + " WHERE pn.pn_id = ?", pn_id)
        rows = _rows_to_dicts(c); conn.close()
        if not rows:
            raise HTTPException(status_code=404, detail="Part number not found")
        return rows[0]
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.delete("/settings/part-numbers/{pn_id}", dependencies=[Depends(verify)])
def settings_delete_part_number(pn_id: int):
    try:
        conn = get_conn(); c = conn.cursor()
        c.execute(_PN_SELECT + " WHERE pn.pn_id = ?", pn_id)
        rows = _rows_to_dicts(c)
        if not rows:
            conn.close()
            raise HTTPException(status_code=404, detail="Part number not found")
        deleted = rows[0]
        c.execute("DELETE FROM ssi_PartNumbers WHERE pn_id = ?", pn_id)
        conn.commit(); conn.close()
        return deleted
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# ── Inspection Points ──────────────────────────────────────────────────────────

_IP_SELECT = """
    SELECT
        ip.inspection_point_id,
        ip.point_name,
        ip.bu_id,
        bu.bu_name,
        ip.sequence_order,
        ip.is_active,
        ISNULL(
            STUFF((
                SELECT ', ' + fm2.fail_code
                FROM ssi_InspectionPointFailModes ipfm2
                INNER JOIN ssi_FailModes fm2 ON ipfm2.fail_mode_id = fm2.fail_mode_id
                WHERE ipfm2.inspection_point_id = ip.inspection_point_id
                FOR XML PATH(''), TYPE
            ).value('.', 'NVARCHAR(MAX)'), 1, 2, ''), ''
        ) AS fail_modes_list
    FROM ssi_InspectionPoints ip
    INNER JOIN ssi_BusinessUnits bu ON ip.bu_id = bu.bu_id
"""


@app.get("/settings/inspection-points", dependencies=[Depends(verify)])
def settings_inspection_points(bu_id: int | None = None):
    sql = _IP_SELECT
    params: list = []
    if bu_id is not None:
        sql += " WHERE ip.bu_id = ?"
        params.append(bu_id)
    sql += " ORDER BY ip.bu_id, ip.sequence_order"
    try:
        conn = get_conn(); c = conn.cursor()
        c.execute(sql, params)
        rows = _rows_to_dicts(c); conn.close()
        return {"data": rows}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/settings/inspection-points", dependencies=[Depends(verify)])
def settings_create_inspection_point(body: InspectionPointCreateBody):
    try:
        conn = get_conn(); c = conn.cursor()
        c.execute(
            """
            INSERT INTO ssi_InspectionPoints (point_name, bu_id, sequence_order, is_active)
            OUTPUT INSERTED.inspection_point_id
            VALUES (?, ?, ?, 1)
            """,
            body.point_name, body.bu_id, body.sequence_order,
        )
        row = c.fetchone()
        new_id = int(row[0]) if row else None
        conn.commit()
        if new_id is None:
            conn.close(); raise HTTPException(status_code=500, detail="INSERT did not return id")
        c.execute(_IP_SELECT + " WHERE ip.inspection_point_id = ?", new_id)
        rows = _rows_to_dicts(c); conn.close()
        return rows[0] if rows else {}
    except HTTPException:
        raise
    except Exception as e:
        tb = traceback.format_exc(); print(tb)
        raise HTTPException(status_code=500, detail=str(e))


@app.patch("/settings/inspection-points/{point_id}", dependencies=[Depends(verify)])
def settings_update_inspection_point(point_id: int, body: InspectionPointUpdateBody):
    sets: list[str] = []; params: list = []
    if body.point_name     is not None: sets.append("point_name = ?");     params.append(body.point_name)
    if body.bu_id          is not None: sets.append("bu_id = ?");          params.append(body.bu_id)
    if body.sequence_order is not None: sets.append("sequence_order = ?"); params.append(body.sequence_order)
    if body.is_active      is not None: sets.append("is_active = ?");      params.append(body.is_active)
    if not sets:
        raise HTTPException(status_code=400, detail="No fields to update")
    try:
        conn = get_conn(); c = conn.cursor()
        c.execute(f"UPDATE ssi_InspectionPoints SET {', '.join(sets)} WHERE inspection_point_id = ?", params + [point_id])
        conn.commit()
        c.execute(_IP_SELECT + " WHERE ip.inspection_point_id = ?", point_id)
        rows = _rows_to_dicts(c); conn.close()
        if not rows:
            raise HTTPException(status_code=404, detail="Inspection point not found")
        return rows[0]
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.delete("/settings/inspection-points/{point_id}", dependencies=[Depends(verify)])
def settings_deactivate_inspection_point(point_id: int):
    try:
        conn = get_conn(); c = conn.cursor()
        c.execute("UPDATE ssi_InspectionPoints SET is_active = 0 WHERE inspection_point_id = ?", point_id)
        conn.commit()
        c.execute(_IP_SELECT + " WHERE ip.inspection_point_id = ?", point_id)
        rows = _rows_to_dicts(c); conn.close()
        if not rows:
            raise HTTPException(status_code=404, detail="Inspection point not found")
        return rows[0]
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# ── Fail Modes ─────────────────────────────────────────────────────────────────

_FM_ASSIGNED_SUBQUERY = """
    ISNULL(
        STUFF((
            SELECT ', ' + ip2.point_name
            FROM ssi_InspectionPointFailModes ipfm2
            INNER JOIN ssi_InspectionPoints ip2 ON ipfm2.inspection_point_id = ip2.inspection_point_id
            WHERE ipfm2.fail_mode_id = fm.fail_mode_id
            FOR XML PATH(''), TYPE
        ).value('.', 'NVARCHAR(MAX)'), 1, 2, ''), ''
    ) AS assigned_points
"""


@app.get("/settings/fail-modes", dependencies=[Depends(verify)])
def settings_fail_modes(bu_id: int | None = None, point_id: int | None = None):
    joins  = ""
    wheres = []
    params: list = []

    if bu_id is not None or point_id is not None:
        joins += " INNER JOIN ssi_InspectionPointFailModes ipfm ON fm.fail_mode_id = ipfm.fail_mode_id"
        if bu_id is not None:
            joins += " INNER JOIN ssi_InspectionPoints ip ON ipfm.inspection_point_id = ip.inspection_point_id"
            wheres.append("ip.bu_id = ?")
            params.append(bu_id)
        if point_id is not None:
            wheres.append("ipfm.inspection_point_id = ?")
            params.append(point_id)

    where_clause = ("WHERE " + " AND ".join(wheres)) if wheres else ""
    distinct     = "DISTINCT" if joins else ""

    sql = f"""
        SELECT {distinct}
            fm.fail_mode_id, fm.fail_code, fm.description, fm.is_active,
            {_FM_ASSIGNED_SUBQUERY}
        FROM ssi_FailModes fm
        {joins}
        {where_clause}
        ORDER BY fm.fail_code
    """
    try:
        conn = get_conn(); c = conn.cursor()
        c.execute(sql, params)
        rows = _rows_to_dicts(c); conn.close()
        return {"data": rows}
    except Exception as e:
        tb = traceback.format_exc(); print(tb)
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/settings/fail-modes", dependencies=[Depends(verify)])
def settings_create_fail_mode(body: FailModeCreateBody):
    try:
        conn = get_conn(); c = conn.cursor()
        c.execute(
            """
            INSERT INTO ssi_FailModes (fail_code, description, is_active)
            OUTPUT INSERTED.fail_mode_id
            VALUES (?, ?, 1)
            """,
            body.fail_code, body.description,
        )
        row = c.fetchone()
        new_id = int(row[0]) if row else None
        conn.commit()
        if new_id is None:
            conn.close(); raise HTTPException(status_code=500, detail="INSERT did not return id")
        c.execute(
            "SELECT fail_mode_id, fail_code, description, is_active, '' AS assigned_points FROM ssi_FailModes WHERE fail_mode_id = ?",
            new_id,
        )
        rows = _rows_to_dicts(c); conn.close()
        return rows[0] if rows else {}
    except HTTPException:
        raise
    except Exception as e:
        tb = traceback.format_exc(); print(tb)
        raise HTTPException(status_code=500, detail=str(e))


@app.patch("/settings/fail-modes/{fail_mode_id}", dependencies=[Depends(verify)])
def settings_update_fail_mode(fail_mode_id: int, body: FailModeUpdateBody):
    sets: list[str] = []; params: list = []
    if body.fail_code   is not None: sets.append("fail_code = ?");   params.append(body.fail_code)
    if body.description is not None: sets.append("description = ?"); params.append(body.description)
    if body.is_active   is not None: sets.append("is_active = ?");   params.append(body.is_active)
    if not sets:
        raise HTTPException(status_code=400, detail="No fields to update")
    try:
        conn = get_conn(); c = conn.cursor()
        c.execute(f"UPDATE ssi_FailModes SET {', '.join(sets)} WHERE fail_mode_id = ?", params + [fail_mode_id])
        conn.commit()
        c.execute(f"""
            SELECT fm.fail_mode_id, fm.fail_code, fm.description, fm.is_active,
                {_FM_ASSIGNED_SUBQUERY}
            FROM ssi_FailModes fm
            WHERE fm.fail_mode_id = ?
        """, fail_mode_id)
        rows = _rows_to_dicts(c); conn.close()
        if not rows:
            raise HTTPException(status_code=404, detail="Fail mode not found")
        return rows[0]
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.delete("/settings/fail-modes/{fail_mode_id}", dependencies=[Depends(verify)])
def settings_deactivate_fail_mode(fail_mode_id: int):
    try:
        conn = get_conn(); c = conn.cursor()
        c.execute("UPDATE ssi_FailModes SET is_active = 0 WHERE fail_mode_id = ?", fail_mode_id)
        conn.commit()
        c.execute(
            "SELECT fail_mode_id, fail_code, description, is_active, '' AS assigned_points FROM ssi_FailModes WHERE fail_mode_id = ?",
            fail_mode_id,
        )
        rows = _rows_to_dicts(c); conn.close()
        if not rows:
            raise HTTPException(status_code=404, detail="Fail mode not found")
        return rows[0]
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/settings/fail-modes/{fail_mode_id}/assign-points", dependencies=[Depends(verify)])
def settings_assign_fail_mode_points(fail_mode_id: int, body: AssignPointsBody):
    try:
        conn = get_conn(); c = conn.cursor()
        c.execute("DELETE FROM ssi_InspectionPointFailModes WHERE fail_mode_id = ?", fail_mode_id)
        for pid in body.point_ids:
            c.execute(
                "INSERT INTO ssi_InspectionPointFailModes (inspection_point_id, fail_mode_id) VALUES (?, ?)",
                pid, fail_mode_id,
            )
        conn.commit()
        conn.close()
        return {"success": True, "assigned": len(body.point_ids)}
    except Exception as e:
        tb = traceback.format_exc(); print(tb)
        raise HTTPException(status_code=500, detail=str(e))


# ── System Config ──────────────────────────────────────────────────────────────

@app.get("/settings/system-config", dependencies=[Depends(verify)])
def settings_system_config():
    try:
        conn = get_conn(); c = conn.cursor()
        c.execute("SELECT config_key, config_value FROM ssi_SystemConfig ORDER BY config_key")
        rows = _rows_to_dicts(c); conn.close()
        return {"data": rows}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.patch("/settings/system-config/{config_key}", dependencies=[Depends(verify)])
def settings_update_system_config(config_key: str, body: SystemConfigUpdateBody):
    try:
        conn = get_conn(); c = conn.cursor()
        c.execute(
            "UPDATE ssi_SystemConfig SET config_value = ? WHERE config_key = ?",
            body.value, config_key,
        )
        conn.commit()
        c.execute("SELECT config_key, config_value FROM ssi_SystemConfig WHERE config_key = ?", config_key)
        rows = _rows_to_dicts(c); conn.close()
        if not rows:
            raise HTTPException(status_code=404, detail="Config key not found")
        return rows[0]
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# ── Part Numbers Lookup (para formulario de reglas de escaneo) ────────────────

@app.get("/settings/part-numbers-lookup", dependencies=[Depends(verify)])
def settings_part_numbers_lookup():
    try:
        conn = get_conn(); c = conn.cursor()
        c.execute("""
            SELECT pn.pn_id, pn.ssiPN, pn.volvoProductNumber, pn.bu_id, bu.bu_name
            FROM ssi_PartNumbers pn
            LEFT JOIN ssi_BusinessUnits bu ON pn.bu_id = bu.bu_id
            ORDER BY pn.ssiPN
        """)
        rows = _rows_to_dicts(c); conn.close()
        return {"data": rows}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))