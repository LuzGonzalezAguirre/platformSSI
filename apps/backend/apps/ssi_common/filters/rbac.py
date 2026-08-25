# apps/ssi_common/filters/rbac.py
"""
RBAC scoping para filtros. Actualmente NO existe restricción real
por BU a nivel de datos — todos los roles pueden ver todas las BUs.
Este módulo es el único punto donde eso debe cambiar cuando se
formalice (ver: "Harden RBAC on assignment endpoints" en backlog).

NO agregar checks de BU en Views o Services individuales — deben
pasar siempre por get_allowed_bu_for_user() para que el día que se
implemente el control real, sea un solo cambio, no N cambios.
"""
from apps.ssi_common.filters.choices import BU_CHOICES

ALL_BU_CODES = tuple(code for code, _ in BU_CHOICES)


def get_allowed_bu_for_user(user) -> tuple[str, ...]:
    # TODO(rbac-bu): reemplazar por lookup real cuando exista
    # un modelo de permisos por BU. Hoy: acceso total para todos los roles.
    return ALL_BU_CODES