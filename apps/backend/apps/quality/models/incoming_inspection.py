# apps/quality/models/incoming_inspection.py
from django.db import models
from apps.identity.models import User


class IncomingContainerSnapshot(models.Model):
    """
    Espejo del estado actual de Part_v_Container filtrado a TJ Incoming
    Inspection. Se trunca y re-inserta completo en cada sync — es snapshot,
    no histórico.
    """
    container_key = models.BigIntegerField(unique=True, db_index=True)
    part_no = models.CharField(max_length=100, db_index=True)
    part_operation_key = models.BigIntegerField(null=True)
    operation_no = models.IntegerField(db_index=True)
    location = models.CharField(max_length=255)
    quantity = models.DecimalField(max_digits=14, decimal_places=4)
    active = models.BooleanField(default=True)
    synced_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'quality_incoming_container_snapshot'
        verbose_name = 'Incoming Container Snapshot'
        indexes = [
            models.Index(fields=["operation_no", "active"]),
        ]

    def __str__(self):
        return f"{self.part_no} @ op{self.operation_no} ({self.container_key})"


class IncomingContainerHistory(models.Model):
    """
    Espejo incremental filtrado de Part_v_Container_Change2 (ops 10/11/20).
    Nunca se trunca — se sincroniza incremental vía watermark.
    """
    serial_no = models.CharField(max_length=100, db_index=True)
    part_no = models.CharField(max_length=100, db_index=True)
    part_key = models.BigIntegerField(null=True)
    operation_no = models.IntegerField(db_index=True)
    change_date = models.DateTimeField(db_index=True)
    last_action = models.CharField(max_length=255, null=True, blank=True)
    location = models.CharField(max_length=255, null=True, blank=True)
    container_status = models.CharField(max_length=50, null=True, blank=True, db_index=True)
    defect_type = models.CharField(max_length=255, null=True, blank=True)
    note = models.TextField(null=True, blank=True)
    change_by = models.CharField(max_length=150, null=True, blank=True)
    synced_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'quality_incoming_container_history'
        verbose_name = 'Incoming Container History'
        constraints = [
            models.UniqueConstraint(
                fields=["serial_no", "change_date", "operation_no"],
                name="uq_incoming_history_dedup",
            )
        ]
        indexes = [
            models.Index(fields=["change_date"]),
            models.Index(fields=["operation_no", "change_date"]),
            models.Index(fields=["container_status"]),
        ]

    def __str__(self):
        return f"{self.serial_no} op{self.operation_no} @ {self.change_date}"


class IncomingInspectionSLAConfig(models.Model):
    """
    Umbral de horas del SLA de inspección, plant-wide. Append-only: cada
    cambio inserta una fila nueva (nunca UPDATE) — esta tabla misma es el
    log de auditoría, sin depender de infraestructura de auditoría externa.
    """
    threshold_hours = models.PositiveIntegerField(default=48)
    updated_by = models.ForeignKey(
        User,
        on_delete=models.PROTECT,
        related_name="+",
    )
    updated_at = models.DateTimeField(auto_now=True)
    previous_value = models.PositiveIntegerField(null=True, blank=True)

    class Meta:
        db_table = 'quality_incoming_inspection_sla_config'
        verbose_name = 'Incoming Inspection SLA Config'
        ordering = ["-updated_at"]

    def __str__(self):
        return f"SLA threshold={self.threshold_hours}h (updated {self.updated_at})"


class IncomingInspectionSyncState(models.Model):
    SYNC_TYPE_CHOICES = [("snapshot", "Snapshot"), ("history", "History")]

    sync_type = models.CharField(max_length=20, choices=SYNC_TYPE_CHOICES, unique=True)
    last_synced_at = models.DateTimeField()
    last_run_status = models.CharField(max_length=20, default="ok")  # ok | error
    last_error_message = models.TextField(null=True, blank=True)

    class Meta:
        db_table = 'quality_incoming_inspection_sync_state'
        verbose_name = 'Incoming Inspection Sync State'

    def __str__(self):
        return f"{self.sync_type} last_synced_at={self.last_synced_at} ({self.last_run_status})"


class IncomingRejectionComment(models.Model):
    """
    Comentarios sobre lotes rechazados (Container_Status = 'Hold'). Append-only
    — sin edición ni borrado, es un log de seguimiento de calidad. serial_no
    es una llave lógica hacia IncomingContainerHistory, no FK real (un mismo
    serial_no puede tener múltiples filas de historial; el comentario aplica
    al lote, no a un evento puntual).
    """
    serial_no = models.CharField(max_length=100, db_index=True)
    comment = models.TextField()
    created_by = models.ForeignKey(
        User,
        on_delete=models.PROTECT,
        related_name="+",
    )
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'quality_incoming_rejection_comment'
        verbose_name = 'Incoming Rejection Comment'
        ordering = ["-created_at"]
        indexes = [
            models.Index(fields=["serial_no", "-created_at"]),
        ]

    def __str__(self):
        return f"Comment on {self.serial_no} by {self.created_by} @ {self.created_at}"