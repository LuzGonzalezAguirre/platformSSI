# apps/quality/models/downtime_workcenter.py
from django.db import models


class DowntimeWorkcenter(models.Model):
    """
    Catálogo de workcenters (Heater Module / TULC) sincronizado desde Plex
    vía Celery Beat. Es de solo-lectura desde la app — el origen de verdad
    es Plex; esta tabla es un espejo para no pegarle al proxy cada vez que
    se abre el settings de asignación de inspectores.
    """
    name = models.CharField(max_length=200, unique=True)
    workcenter_group = models.CharField(max_length=100)
    active = models.BooleanField(default=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["name"]

    def __str__(self):
        return self.name