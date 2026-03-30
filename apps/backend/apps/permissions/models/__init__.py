from django.db import models


class Module(models.TextChoices):
    PRODUCTION     = "production",     "Producción"
    QUALITY        = "quality",        "Calidad"
    MAINTENANCE    = "maintenance",    "Mantenimiento"
    WAREHOUSE      = "warehouse",      "Almacén"
    ADMINISTRATION = "administration", "Administración"


class Action(models.TextChoices):
    VIEW   = "view",   "Ver"
    CREATE = "create", "Crear"
    EDIT   = "edit",   "Editar"
    DELETE = "delete", "Eliminar"


class Permission(models.Model):
    key         = models.CharField(max_length=100, unique=True)
    module      = models.CharField(max_length=50, choices=Module.choices)
    action      = models.CharField(max_length=50, choices=Action.choices)
    description = models.CharField(max_length=200, blank=True)

    class Meta:
        unique_together = ("module", "action")
        indexes = [models.Index(fields=["key"])]
        ordering = ["module", "action"]

    def __str__(self):
        return self.key

    def save(self, *args, **kwargs):
        self.key = f"{self.module}.{self.action}"
        super().save(*args, **kwargs)


class Role(models.Model):
    name        = models.CharField(max_length=100, unique=True)
    slug        = models.SlugField(max_length=100, unique=True)
    description = models.CharField(max_length=200, blank=True)
    is_system   = models.BooleanField(default=False)
    permissions = models.ManyToManyField(Permission, through="RolePermission", related_name="roles")
    created_at  = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["name"]

    def __str__(self):
        return self.name


class RolePermission(models.Model):
    role       = models.ForeignKey(Role, on_delete=models.CASCADE, related_name="role_permissions")
    permission = models.ForeignKey(Permission, on_delete=models.CASCADE, related_name="role_permissions")

    class Meta:
        unique_together = ("role", "permission")
        indexes = [
            models.Index(fields=["role"]),
            models.Index(fields=["permission"]),
        ]

    def __str__(self):
        return f"{self.role.slug} → {self.permission.key}"


class UserPermissionOverride(models.Model):
    GRANT  = "grant"
    REVOKE = "revoke"
    OVERRIDE_TYPES = [(GRANT, "Otorgar"), (REVOKE, "Revocar")]

    user       = models.ForeignKey(
        "identity.User",
        on_delete=models.CASCADE,
        related_name="permission_overrides",
    )
    permission = models.ForeignKey(Permission, on_delete=models.CASCADE, related_name="overrides")
    override_type = models.CharField(max_length=10, choices=OVERRIDE_TYPES)

    class Meta:
        unique_together = ("user", "permission")
        indexes = [
            models.Index(fields=["user"]),
            models.Index(fields=["permission"]),
        ]

    def __str__(self):
        return f"{self.user.employee_id} — {self.override_type} {self.permission.key}"
class UserRole(models.Model):
    user = models.ForeignKey(
        "identity.User",
        on_delete=models.CASCADE,
        related_name="user_roles",
    )
    role = models.ForeignKey(
        Role,
        on_delete=models.CASCADE,
        related_name="user_roles",
    )

    class Meta:
        unique_together = ("user", "role")
        indexes = [
            models.Index(fields=["user"]),
            models.Index(fields=["role"]),
        ]

    def __str__(self):
        return f"{self.user.employee_id} → {self.role.slug}"