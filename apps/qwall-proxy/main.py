import os
import pyodbc
from fastapi import FastAPI, HTTPException, Depends
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from pydantic import BaseModel

app    = FastAPI()
bearer = HTTPBearer()

TOKEN   = os.getenv("QWALL_PROXY_TOKEN", "7a31cd3e242533dfc1b2962b1d84c47ddb3065e2752654c7f23b2e06f3dd988e")
CONN_STR = "DRIVER={ODBC Driver 17 for SQL Server};SERVER=AAS-PAC-FTP01;DATABASE=CCS;Trusted_Connection=yes;"


def verify(creds: HTTPAuthorizationCredentials = Depends(bearer)):
    if creds.credentials != TOKEN:
        raise HTTPException(status_code=401, detail="Unauthorized")


class DateRange(BaseModel):
    start_date: str
    end_date:   str


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
        conn   = pyodbc.connect(CONN_STR, timeout=10)
        cursor = conn.cursor()
        cursor.execute(query, body.start_date, body.end_date)
        columns = [col[0] for col in cursor.description]
        rows    = [dict(zip(columns, row)) for row in cursor.fetchall()]
        conn.close()
        # Serializar fechas a string
        for r in rows:
            if hasattr(r.get("inspection_date"), "isoformat"):
                r["inspection_date"] = r["inspection_date"].isoformat()
        return {"data": rows}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))