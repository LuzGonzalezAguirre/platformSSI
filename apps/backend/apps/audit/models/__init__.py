from django.db import models
from django.conf import settings


class AuditLog(models.Model):
    class Action(models.TextChoices):
        LOGIN = "LOGIN", "Login"
        LOGOUT = "LOGOUT", "Logout"
        CREATE = "CREATE", "Crear"
        UPDATE = "UPDATE", "Actualizar"
        DELETE = "DELETE", "Eliminar"

    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        related_name="audit_logs",
        verbose_name="Usuario",
    )
    action = models.CharField(
        max_length=10,
        choices=Action.choices,
        verbose_name="Acción",
    )
    module = models.CharField(max_length=50, blank=True, verbose_name="Módulo")
    resource = models.CharField(max_length=100, blank=True, verbose_name="Recurso")
    resource_id = models.CharField(max_length=50, blank=True, verbose_name="ID Recurso")
    description = models.CharField(max_length=255, blank=True, verbose_name="Descripción")
    ip_address = models.GenericIPAddressField(null=True, blank=True, verbose_name="IP")
    user_agent = models.CharField(max_length=255, blank=True, verbose_name="User Agent")
    timestamp = models.DateTimeField(
        auto_now_add=True,
        verbose_name="Fecha/Hora",
        db_index=True,
    )

    class Meta:
        db_table = "audit_log"
        verbose_name = "Log de Auditoría"
        verbose_name_plural = "Logs de Auditoría"
        ordering = ["-timestamp"]

    def __str__(self):
        return f"{self.timestamp:%Y-%m-%d %H:%M} — {self.user} — {self.action} — {self.module}"
