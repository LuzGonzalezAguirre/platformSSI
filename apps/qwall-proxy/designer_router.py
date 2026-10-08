"""Q-Wall Designer API using the existing CCS tables. No schema migrations."""
import base64
import binascii
from datetime import datetime
from contextlib import contextmanager
import hmac

import pyodbc
from fastapi import APIRouter, Depends, Header, HTTPException
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from pydantic import BaseModel, Field, ConfigDict

from config import require_env

router = APIRouter()
_token = require_env("QWALL_PROXY_TOKEN")
_conn_str = require_env("QWALL_DB_CONN_STR")
_bearer = HTTPBearer()


def authenticate(credentials: HTTPAuthorizationCredentials = Depends(_bearer)):
    if not hmac.compare_digest(credentials.credentials, _token):
        raise HTTPException(401, "Unauthorized")


def actor(x_designer_user: str | None = Header(default=None)):
    # This header is supplied by the authenticated Django gateway, not the browser.
    return (x_designer_user or "platformSSI")[:100]


@contextmanager
def database(write=False):
    conn = pyodbc.connect(_conn_str, timeout=15)
    try:
        yield conn.cursor()
        if write:
            conn.commit()
    except Exception:
        if write:
            conn.rollback()
        raise
    finally:
        conn.close()


def records(cursor):
    fields = [c[0] for c in cursor.description]
    return [{name: (value.isoformat() if isinstance(value, datetime) else value)
             for name, value in zip(fields, row)} for row in cursor.fetchall()]


def one(cursor):
    rows = records(cursor)
    if not rows:
        raise HTTPException(404, "Step not found")
    return rows[0]


def picture(data):
    try:
        raw = base64.b64decode(data, validate=True)
    except (binascii.Error, ValueError):
        raise HTTPException(422, "Invalid base64 image")
    if not raw or len(raw) > 15 * 1024 * 1024:
        raise HTTPException(413, "Image size must be within 15 MB")
    if not (raw.startswith(b"\\xff\\xd8\\xff") or raw.startswith(b"\\x89PNG\\r\\n\\x1a\\n")):
        raise HTTPException(422, "Only JPEG or PNG images are supported")
    return raw


class Position(BaseModel):
    element_type: str
    point_name: str | None = None
    display_label: str | None = None
    data_binding: str | None = None
    width: int | None = Field(default=None, ge=1, le=10000)
    height: int | None = Field(default=None, ge=1, le=10000)
    pos_x: int = Field(ge=0, le=100000)
    pos_y: int = Field(ge=0, le=100000)


class Positions(BaseModel):
    positions: list[Position] = Field(max_length=250)


class StepCreate(BaseModel):
    bu_id: int = Field(gt=0)
    part_number: str = Field(min_length=1, max_length=50)
    step_number: int = Field(gt=0)
    flow_order: int = Field(gt=0)
    step_image_base64: str
    image_width: int = Field(gt=0, le=20000)
    image_height: int = Field(gt=0, le=20000)
    image_name: str = Field(default="", max_length=200)


class StepUpdate(BaseModel):
    step_number: int | None = Field(default=None, gt=0)
    flow_order: int | None = Field(default=None, gt=0)
    image_name: str | None = Field(default=None, max_length=200)


class ImageUpdate(StepUpdate):
    step_image_base64: str | None = None
    image_width: int | None = Field(default=None, gt=0, le=20000)
    image_height: int | None = Field(default=None, gt=0, le=20000)


class CloneTargets(BaseModel):
    part_numbers: list[str] = Field(max_length=100)


class PartCreate(BaseModel):
    ssiPN: str = Field(min_length=1, max_length=50)
    volvoProductNumber: str | None = Field(default=None, max_length=50)
    bu_id: int = Field(gt=0)


class PointCreate(BaseModel):
    point_name: str = Field(min_length=1, max_length=100)
    description: str | None = Field(default=None, max_length=255)
    step_image: int | None = None
    sequence_order: int | None = None
    bu_id: int = Field(gt=0)
    has_camera_verification: bool = False
    is_active: bool = True


STEP_COLS = """step_id, bu_id, part_number, step_number, flow_order,
       image_width, image_height, image_name, status, version, updated_by, updated_at"""


def load_steps(cursor, bu_id=None, part_number=None, step_id=None):
    conditions = []
    values = []
    if bu_id is not None:
        conditions.append("bu_id = ?")
        values.append(bu_id)
    if part_number is not None:
        conditions.append("part_number = ?")
        values.append(part_number)
    if step_id is not None:
        conditions.append("step_id = ?")
        values.append(step_id)
    where = " WHERE " + " AND ".join(conditions) if conditions else ""
    cursor.execute(f"SELECT {STEP_COLS} FROM dbo.ssi_StepDesigner{where} ORDER BY flow_order, step_id", *values)
    steps = records(cursor)
    for step in steps:
        cursor.execute("""SELECT position_id, element_type, point_name, display_label, data_binding,
                          width, height, pos_x, pos_y FROM dbo.ssi_ButtonPositions
                          WHERE step_id = ? ORDER BY position_id""", step["step_id"])
        step["positions"] = records(cursor)
        cursor.execute("SELECT step_image FROM dbo.ssi_StepDesigner WHERE step_id = ?", step["step_id"])
        image = cursor.fetchone()[0]
        step["step_image_base64"] = base64.b64encode(bytes(image)).decode() if image is not None else None
    return steps


def existing(cursor, step_id):
    steps = load_steps(cursor, step_id=step_id)
    if not steps:
        raise HTTPException(404, "Step not found")
    return steps[0]


def validate_bu_part(cursor, bu_id, part_number):
    cursor.execute("SELECT 1 FROM dbo.ssi_PartNumbers WHERE bu_id = ? AND ssiPN = ?", bu_id, part_number)
    if cursor.fetchone() is None:
        raise HTTPException(422, "Part number does not belong to the selected BU")


def validate_positions(cursor, bu_id, positions):
    if any(p.element_type not in {"inspection_point", "label"} for p in positions):
        raise HTTPException(422, "Unsupported element type")
    for pos in positions:
        if pos.element_type == "inspection_point":
            if not pos.point_name:
                raise HTTPException(422, "Inspection point name is required")
            cursor.execute("""SELECT 1 FROM dbo.ssi_InspectionPoints
                              WHERE bu_id = ? AND point_name = ? AND is_active = 1""",
                           bu_id, pos.point_name)
            if cursor.fetchone() is None:
                raise HTTPException(422, "Inspection point is not valid for selected BU")


def replace_positions(cursor, step_id, bu_id, positions):
    validate_positions(cursor, bu_id, positions)
    cursor.execute("DELETE FROM dbo.ssi_ButtonPositions WHERE step_id = ?", step_id)
    for p in positions:
        cursor.execute("""INSERT INTO dbo.ssi_ButtonPositions
               (step_id, element_type, point_name, display_label, data_binding, width, height, pos_x, pos_y)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)""", step_id, p.element_type, p.point_name,
               p.display_label, p.data_binding, p.width, p.height, p.pos_x, p.pos_y)


@router.get("/business-units", dependencies=[Depends(authenticate)])
def business_units():
    with database() as c:
        c.execute("SELECT bu_id, bu_name, uses_dynamic_buttons, uses_batch_mode FROM dbo.ssi_BusinessUnits ORDER BY bu_name")
        return records(c)


@router.get("/part-numbers", dependencies=[Depends(authenticate)])
def parts(bu_id: int | None = None):
    with database() as c:
        c.execute("""SELECT pn_id, ssiPN, volvoProductNumber, bu_id FROM dbo.ssi_PartNumbers
                     WHERE (? IS NULL OR bu_id = ?) ORDER BY ssiPN""", bu_id, bu_id)
        return records(c)


@router.post("/part-numbers", status_code=201, dependencies=[Depends(authenticate)])
def add_part(body: PartCreate):
    with database(write=True) as c:
        c.execute("""INSERT INTO dbo.ssi_PartNumbers(ssiPN, volvoProductNumber, bu_id)
                     OUTPUT INSERTED.pn_id VALUES (?, ?, ?)""",
                  body.ssiPN, body.volvoProductNumber, body.bu_id)
        key = c.fetchone()[0]
        c.execute("SELECT pn_id, ssiPN, volvoProductNumber, bu_id FROM dbo.ssi_PartNumbers WHERE pn_id = ?", key)
        return one(c)


@router.get("/inspection-points", dependencies=[Depends(authenticate)])
def points(bu_id: int | None = None):
    with database() as c:
        c.execute("""SELECT inspection_point_id, point_name, description, step_image, sequence_order,
                     bu_id, has_camera_verification, is_active
                     FROM dbo.ssi_InspectionPoints WHERE is_active = 1
                     AND (? IS NULL OR bu_id = ?) ORDER BY sequence_order, point_name""", bu_id, bu_id)
        return records(c)


@router.post("/inspection-points", status_code=201, dependencies=[Depends(authenticate)])
def add_point(body: PointCreate):
    with database(write=True) as c:
        c.execute("""INSERT INTO dbo.ssi_InspectionPoints(point_name, description, step_image,
                     sequence_order, bu_id, has_camera_verification, is_active)
                     OUTPUT INSERTED.inspection_point_id VALUES (?, ?, ?, ?, ?, ?, ?)""",
                  body.point_name, body.description, body.step_image, body.sequence_order,
                  body.bu_id, body.has_camera_verification, body.is_active)
        key = c.fetchone()[0]
        c.execute("""SELECT inspection_point_id, point_name, description, step_image, sequence_order,
                     bu_id, has_camera_verification, is_active
                     FROM dbo.ssi_InspectionPoints WHERE inspection_point_id = ?""", key)
        return one(c)


@router.get("/steps", dependencies=[Depends(authenticate)])
def steps(bu_id: int | None = None, part_number: str | None = None):
    with database() as c:
        return load_steps(c, bu_id, part_number)


@router.get("/steps/{step_id}", dependencies=[Depends(authenticate)])
def step_get(step_id: int):
    with database() as c:
        return existing(c, step_id)


@router.post("/steps", status_code=201, dependencies=[Depends(authenticate)])
def step_create(body: StepCreate, user: str = Depends(actor)):
    image = picture(body.step_image_base64)
    with database(write=True) as c:
        validate_bu_part(c, body.bu_id, body.part_number)
        c.execute("""INSERT INTO dbo.ssi_StepDesigner
                     (bu_id, part_number, step_number, flow_order, step_image, image_width,
                      image_height, image_name, status, version, updated_by, updated_at)
                     OUTPUT INSERTED.step_id
                     VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'draft', 1, ?, SYSUTCDATETIME())""",
                  body.bu_id, body.part_number, body.step_number, body.flow_order, image,
                  body.image_width, body.image_height, body.image_name, user)
        key = c.fetchone()[0]
        return existing(c, key)


@router.patch("/steps/{step_id}", dependencies=[Depends(authenticate)])
def step_update(step_id: int, body: StepUpdate, user: str = Depends(actor)):
    updates = body.model_dump(exclude_unset=True)
    if not updates:
        with database() as c:
            return existing(c, step_id)
    with database(write=True) as c:
        existing(c, step_id)
        columns = ", ".join(f"{field} = ?" for field in updates)
        c.execute(f"""UPDATE dbo.ssi_StepDesigner SET {columns},
                     status = 'draft', updated_by = ?, updated_at = SYSUTCDATETIME()
                     WHERE step_id = ?""", *updates.values(), user, step_id)
        return existing(c, step_id)


@router.post("/steps/{step_id}/update_image", dependencies=[Depends(authenticate)])
def step_image(step_id: int, body: ImageUpdate, user: str = Depends(actor)):
    values = body.model_dump(exclude_unset=True)
    if "step_image_base64" in values:
        if not values["step_image_base64"] or not values.get("image_width") or not values.get("image_height"):
            raise HTTPException(422, "Image and dimensions must be provided together")
        values["step_image"] = picture(values.pop("step_image_base64"))
    with database(write=True) as c:
        existing(c, step_id)
        if values:
            columns = ", ".join(f"{field} = ?" for field in values)
            c.execute(f"""UPDATE dbo.ssi_StepDesigner SET {columns},
                          status = 'draft', updated_by = ?, updated_at = SYSUTCDATETIME()
                          WHERE step_id = ?""", *values.values(), user, step_id)
        return existing(c, step_id)


@router.post("/steps/{step_id}/save_positions", dependencies=[Depends(authenticate)])
def save_positions(step_id: int, body: Positions, user: str = Depends(actor)):
    with database(write=True) as c:
        step = existing(c, step_id)
        replace_positions(c, step_id, step["bu_id"], body.positions)
        c.execute("""UPDATE dbo.ssi_StepDesigner SET status='draft', updated_by=?,
                     updated_at=SYSUTCDATETIME() WHERE step_id=?""", user, step_id)
        return existing(c, step_id)


@router.post("/steps/{step_id}/clone_to_models", dependencies=[Depends(authenticate)])
def clone_to_models(step_id: int, body: CloneTargets, user: str = Depends(actor)):
    copied = []
    with database(write=True) as c:
        source = existing(c, step_id)
        c.execute("SELECT step_image FROM dbo.ssi_StepDesigner WHERE step_id=?", step_id)
        image = bytes(c.fetchone()[0])
        for part in dict.fromkeys(body.part_numbers):
            if part == source["part_number"]:
                continue
            validate_bu_part(c, source["bu_id"], part)
            c.execute("""SELECT step_id FROM dbo.ssi_StepDesigner
                          WHERE bu_id=? AND part_number=? AND step_number=?""",
                      source["bu_id"], part, source["step_number"])
            found = c.fetchone()
            if found:
                target_id = found[0]
                c.execute("""UPDATE dbo.ssi_StepDesigner SET flow_order=?, step_image=?,
                             image_width=?, image_height=?, image_name=?, status='draft',
                             updated_by=?, updated_at=SYSUTCDATETIME() WHERE step_id=?""",
                          source["flow_order"], image, source["image_width"], source["image_height"],
                          source["image_name"], user, target_id)
            else:
                c.execute("""INSERT INTO dbo.ssi_StepDesigner
                             (bu_id, part_number, step_number, flow_order, step_image,
                              image_width, image_height, image_name, status, version,
                              updated_by, updated_at) OUTPUT INSERTED.step_id
                             VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'draft', 1, ?, SYSUTCDATETIME())""",
                          source["bu_id"], part, source["step_number"], source["flow_order"],
                          image, source["image_width"], source["image_height"], source["image_name"], user)
                target_id = c.fetchone()[0]
            replace_positions(c, target_id, source["bu_id"], [Position(**p) for p in source["positions"]])
            copied.append(part)
    return {"cloned_to": copied}


@router.post("/steps/{step_id}/publish", dependencies=[Depends(authenticate)])
def publish(step_id: int, user: str = Depends(actor)):
    with database(write=True) as c:
        step = existing(c, step_id)
        new_version = step["version"] + 1
        c.execute("""UPDATE dbo.ssi_StepDesigner SET version=?, status='published',
                     updated_by=?, updated_at=SYSUTCDATETIME() WHERE step_id=?""",
                  new_version, user, step_id)
        c.execute("""INSERT INTO dbo.ssi_StepDesigner_History
                   (step_id, version, bu_id, part_number, step_number, flow_order, step_image,
                    image_width, image_height, image_name, published_by, published_at)
                   OUTPUT INSERTED.history_id
                   SELECT step_id, version, bu_id, part_number, step_number, flow_order, step_image,
                          image_width, image_height, image_name, ?, SYSUTCDATETIME()
                   FROM dbo.ssi_StepDesigner WHERE step_id=?""", user, step_id)
        history_id = c.fetchone()[0]
        c.execute("""INSERT INTO dbo.ssi_ButtonPositions_History
                    (step_history_id, version, element_type, point_name, display_label,
                     data_binding, width, height, pos_x, pos_y)
                    SELECT ?, ?, element_type, point_name, display_label,
                           data_binding, width, height, pos_x, pos_y
                    FROM dbo.ssi_ButtonPositions WHERE step_id=?""", history_id, new_version, step_id)
        return existing(c, step_id)


@router.delete("/steps/{step_id}", dependencies=[Depends(authenticate)])
def remove_step(step_id: int):
    with database(write=True) as c:
        step = existing(c, step_id)
        if step["status"] == "published":
            raise HTTPException(409, "Published steps cannot be deleted")
        c.execute("DELETE FROM dbo.ssi_ButtonPositions WHERE step_id=?", step_id)
        c.execute("DELETE FROM dbo.ssi_StepDesigner WHERE step_id=?", step_id)
        return {"deleted": step_id}
