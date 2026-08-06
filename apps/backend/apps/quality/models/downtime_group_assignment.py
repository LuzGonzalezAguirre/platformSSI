# apps/quality/models/downtime_group_assignment.py
from django.conf import settings
from django.db import models


class DowntimeGroupAssignment(models.Model):
    """
    Inspector asignado a un SCOPE (workcenter group, o subgrupo de BU dentro
    de un group) en un día específico.

    Convive con DowntimeWorkcenterAssignment, que a partir de ahora significa
    OVERRIDE individual, no "la asignación". La precedencia al resolver es:

        override de workcenter  >  subgrupo  >  grupo

    subgroup_key = "" significa "todo el grupo". Para 'Heater Module' los
    subgrupos válidos salen de apps.ssi_common.bu_classification
    (VOLVO / CUMMINS) — NO se hardcodean aquí ni en el frontend.

    inspector_user_id / inspector_name son un SNAPSHOT de ssi_Users (CCS,
    SQL Server read-only vía qwall-proxy), igual que en el modelo de
    workcenter: no hay integridad referencial posible cruzando motores.

    Una fila con inspector_user_id = NULL es una decisión explícita de
    "sin asignar" y detiene la herencia hacia días anteriores. La AUSENCIA
    de fila es lo que permite heredar.
    """
    date = models.DateField()
    group_key = models.CharField(max_length=100)
    subgroup_key = models.CharField(max_length=50, blank=True, default="")
    inspector_user_id = models.IntegerField(null=True, blank=True)
    inspector_name = models.CharField(max_length=100, null=True, blank=True)
    updated_at = models.DateTimeField(auto_now=True)
    updated_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, null=True, blank=True, on_delete=models.SET_NULL,
    )

    class Meta:
        constraints = [
            models.UniqueConstraint(
                fields=["date", "group_key", "subgroup_key"],
                name="uniq_downtime_group_assignment_per_day",
            ),
        ]
        indexes = [
            models.Index(fields=["date"], name="idx_downtime_grp_assign_date"),
        ]
        ordering = ["-date", "group_key", "subgroup_key"]

    def __str__(self):
        scope = f"{self.group_key}/{self.subgroup_key}" if self.subgroup_key else self.group_key
        return f"{scope} — {self.date} — {self.inspector_name or '(sin asignar)'}"