# apps/qwall-proxy/main.py

import os
import base64
import pyodbc
from fastapi import FastAPI, HTTPException, Depends
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from pydantic import BaseModel


app    = FastAPI()
bearer = HTTPBearer()

TOKEN    = os.getenv("QWALL_PROXY_TOKEN", "7a31cd3e242533dfc1b2962b1d84c47ddb3065e2752654c7f23b2e06f3dd988e")
CONN_STR = "DRIVER={ODBC Driver 17 for SQL Server};SERVER=AAS-PAC-FTP01;DATABASE=CCS;Trusted_Connection=yes;"


def verify(creds: HTTPAuthorizationCredentials = Depends(bearer)):
    if creds.credentials != TOKEN:
        raise HTTPException(status_code=401, detail="Unauthorized")


def get_conn():
    return pyodbc.connect(CONN_STR, timeout=10)


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
    except Exception as e:
        tb = traceback.format_exc()  # agregar
        print(tb)                    # agregar — aparece en la ventana del proxy
        raise HTTPException(status_code=500, detail=tb)  # cambiar
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