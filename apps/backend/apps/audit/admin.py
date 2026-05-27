from django.contrib import admin
from apps.audit.models import AuditLog

_ACTION_VERBS = {
    "CREATE": "Creó",
    "UPDATE": "Actualizó",
    "DELETE": "Eliminó",
    "LOGIN": "Inició sesión",
    "LOGOUT": "Cerró sesión",
}


@admin.register(AuditLog)
class AuditLogAdmin(admin.ModelAdmin):
    list_display = ("timestamp", "user", "accion_detalle", "module", "ip_address")
    list_filter = ("action", "module")
    search_fields = ("user__employee_id", "user__first_name", "user__last_name", "description")
    readonly_fields = ("timestamp",)
    ordering = ("-timestamp",)

    @admin.display(description="Acción / Detalle")
    def accion_detalle(self, obj):
        verb = _ACTION_VERBS.get(obj.action, obj.action)
        parts = [verb]
        if obj.resource:
            parts.append(obj.resource)
        if obj.resource_id:
            parts.append(f"#{obj.resource_id}")
        if obj.description:
            parts.append(f"— {obj.description}")
        return " ".join(parts)
