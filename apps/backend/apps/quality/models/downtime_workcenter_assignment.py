# apps/quality/models/downtime_workcenter_assignment.py
from django.conf import settings
from django.db import models

from apps.quality.models.downtime_workcenter import DowntimeWorkcenter


class DowntimeWorkcenterAssignment(models.Model):
    """
    Inspector asignado a un workcenter en un día específico. Editable sin
    restricción para cualquier fecha (pasada o futura) por cualquier
    usuario con acceso al módulo de Quality.

    inspector_user_id / inspector_name son un SNAPSHOT del usuario en
    ssi_Users (CCS, vía qwall-proxy) al momento de guardar — no un FK real,
    porque CCS es una base de datos externa de solo lectura (SQL Server),
    no se puede tener integridad referencial cruzada con Postgres. El
    frontend ya trae la lista de inspectores (role_id=4, activos) para el
    dropdown, así que manda ambos valores juntos sin round-trip extra al
    proxy en cada guardado.
    """
    workcenter = models.ForeignKey(
        DowntimeWorkcenter, on_delete=models.PROTECT, related_name="assignments",
    )
    date = models.DateField()
    inspector_user_id = models.IntegerField(null=True, blank=True)
    inspector_name = models.CharField(max_length=100, null=True, blank=True)
    updated_at = models.DateTimeField(auto_now=True)
    updated_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, null=True, blank=True, on_delete=models.SET_NULL,
    )

    class Meta:
        constraints = [
            models.UniqueConstraint(fields=["workcenter", "date"], name="uniq_downtime_wc_assignment_per_day"),
        ]
        ordering = ["-date", "workcenter__name"]

    def __str__(self):
        return f"{self.workcenter.name} — {self.date} — {self.inspector_name or '(sin asignar)'}"