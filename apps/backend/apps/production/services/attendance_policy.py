from decimal import Decimal, InvalidOperation

# ── Semántica de estatus ──────────────────────────────────────────────────
# Fuente única de verdad, compartida por AttendanceRecord y CcsAttendanceRecord
# (ambos modelos usan los mismos valores de string). Cualquier consumidor debe
# importar de aquí y NUNCA comparar contra literales sueltos.

PRESENT  = "present"
ABSENT   = "absent"
VACATION = "vacation"
LEAVE    = "leave"
SICK     = "sick"

# Estatus que fuerzan 0 horas pagadas.
ZERO_HOUR_STATUSES = frozenset({ABSENT, VACATION})

# Ausencia planeada: se descuenta del denominador de headcount porque el
# empleado no estaba programado para trabajar. NO es ausentismo.
PLANNED_ABSENCE_STATUSES = frozenset({VACATION})

# Ausencia no planeada: sí cuenta como ausentismo.
UNPLANNED_ABSENCE_STATUSES = frozenset({ABSENT})

# Estatus que representan presencia física en piso.
PRESENCE_STATUSES = frozenset({PRESENT})

ZERO = Decimal("0")


class AttendancePolicy:

    @staticmethod
    def is_zero_hour(status: str) -> bool:
        return status in ZERO_HOUR_STATUSES

    @staticmethod
    def is_planned_absence(status: str) -> bool:
        return status in PLANNED_ABSENCE_STATUSES

    @staticmethod
    def resolve_hours(status: str, requested_hours) -> Decimal:
        """
        Las horas no las decide el cliente, las decide el estatus. Un cliente
        puede mandar 12h con status=vacation; el backend gana siempre.
        """
        if status in ZERO_HOUR_STATUSES:
            return ZERO
        try:
            hours = Decimal(str(requested_hours))
        except (InvalidOperation, TypeError, ValueError):
            return ZERO
        return hours if hours > ZERO else ZERO

    @staticmethod
    def resolve_shift(status: str, requested_shift: str) -> str:
        if status in ZERO_HOUR_STATUSES:
            return "none"
        return requested_shift

    @staticmethod
    def summarize(rows: list[dict]) -> dict:
        """
        rows: [{"status": str, "hours": Decimal|float|str}, ...]

        headcount_base excluye ausencias planeadas: un empleado de vacaciones
        no diluye el % de asistencia del turno.
        """
        total    = len(rows)
        present  = sum(1 for r in rows if r["status"] in PRESENCE_STATUSES)
        absent   = sum(1 for r in rows if r["status"] in UNPLANNED_ABSENCE_STATUSES)
        vacation = sum(1 for r in rows if r["status"] in PLANNED_ABSENCE_STATUSES)

        paid_hours = ZERO
        for r in rows:
            paid_hours += AttendancePolicy.resolve_hours(r["status"], r.get("hours", 0))

        headcount_base = total - vacation
        attendance_pct = (
            round(present / headcount_base * 100, 1) if headcount_base > 0 else 0.0
        )

        return {
            "total":          total,
            "present":        present,
            "absent":         absent,
            "vacation":       vacation,
            "headcount_base": headcount_base,
            "attendance_pct": attendance_pct,
            "paid_hours":     float(paid_hours),
        }