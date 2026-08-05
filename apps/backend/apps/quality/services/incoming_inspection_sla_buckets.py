# apps/quality/services/incoming_inspection_sla_buckets.py
"""
Buckets de antigüedad derivados dinámicamente del umbral de SLA vigente.
Se expresan como fracciones del umbral (T/4, T/2, T, >T) para que cambiar
threshold_hours en configuración reajuste dashboard y backlog sin tocar código.
"""

BUCKET_KEYS = ("q1", "q2", "q3", "over")


def build_buckets(threshold_hours: int) -> list[dict]:
    quarter = threshold_hours / 4
    return [
        {"key": "q1", "min_hours": 0.0, "max_hours": round(quarter, 2), "breached": False},
        {"key": "q2", "min_hours": round(quarter, 2), "max_hours": round(quarter * 2, 2), "breached": False},
        {"key": "q3", "min_hours": round(quarter * 2, 2), "max_hours": float(threshold_hours), "breached": False},
        {"key": "over", "min_hours": float(threshold_hours), "max_hours": None, "breached": True},
    ]


def bucket_key(hours: float, threshold_hours: int) -> str:
    quarter = threshold_hours / 4
    if hours <= quarter:
        return "q1"
    if hours <= quarter * 2:
        return "q2"
    if hours <= threshold_hours:
        return "q3"
    return "over"


def percentile(sorted_values: list[float], pct: float) -> float | None:
    if not sorted_values:
        return None
    position = (len(sorted_values) - 1) * pct
    lower = int(position)
    upper = min(lower + 1, len(sorted_values) - 1)
    if lower == upper:
        return round(sorted_values[lower], 2)
    weight = position - lower
    return round(sorted_values[lower] + (sorted_values[upper] - sorted_values[lower]) * weight, 2)