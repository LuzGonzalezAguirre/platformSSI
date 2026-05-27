from django.conf import settings
from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):
    initial = True

    dependencies = [
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
    ]

    operations = [
        migrations.CreateModel(
            name="AuditLog",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("action", models.CharField(
                    choices=[
                        ("LOGIN", "Login"),
                        ("LOGOUT", "Logout"),
                        ("CREATE", "Crear"),
                        ("UPDATE", "Actualizar"),
                        ("DELETE", "Eliminar"),
                    ],
                    max_length=10,
                    verbose_name="Acción",
                )),
                ("module", models.CharField(blank=True, max_length=50, verbose_name="Módulo")),
                ("resource", models.CharField(blank=True, max_length=100, verbose_name="Recurso")),
                ("resource_id", models.CharField(blank=True, max_length=50, verbose_name="ID Recurso")),
                ("description", models.CharField(blank=True, max_length=255, verbose_name="Descripción")),
                ("ip_address", models.GenericIPAddressField(blank=True, null=True, verbose_name="IP")),
                ("user_agent", models.CharField(blank=True, max_length=255, verbose_name="User Agent")),
                ("timestamp", models.DateTimeField(auto_now_add=True, db_index=True, verbose_name="Fecha/Hora")),
                ("user", models.ForeignKey(
                    null=True,
                    on_delete=django.db.models.deletion.SET_NULL,
                    related_name="audit_logs",
                    to=settings.AUTH_USER_MODEL,
                    verbose_name="Usuario",
                )),
            ],
            options={
                "verbose_name": "Log de Auditoría",
                "verbose_name_plural": "Logs de Auditoría",
                "db_table": "audit_log",
                "ordering": ["-timestamp"],
            },
        ),
    ]
