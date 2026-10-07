# apps/ssi_common/filters/rbac.py
"""Business Unit visibility policy shared by operational modules.

Business rule:
- every authenticated platform user may see every Business Unit;
- role, department and module permissions do not reduce BU visibility;
- a BU supplied in a request is a functional filter, not an authorization
  boundary.

Views and services should continue to call get_allowed_bu_for_user() instead
of hardcoding ALL_BU_CODES. Keeping one resolver makes the policy explicit and
prevents different modules from inventing their own BU visibility rules.
"""
from apps.ssi_common.filters.choices import BU_CHOICES

ALL_BU_CODES = tuple(code for code, _ in BU_CHOICES)


def get_allowed_bu_for_user(user) -> tuple[str, ...]:
    """Return the complete BU catalog for every authenticated platform role."""
    return ALL_BU_CODES
