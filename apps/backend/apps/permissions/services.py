from django.db import transaction
from apps.permissions.models import Permission, Role, RolePermission, UserPermissionOverride, UserRole, Module, Action


# ─── Permisos seed ────────────────────────────────────────────────────────────

PERMISSION_DEFINITIONS = [
    (Module.PRODUCTION,     Action.VIEW,   "Ver módulo de Producción"),
    (Module.PRODUCTION,     Action.CREATE, "Crear registros en Producción"),
    (Module.PRODUCTION,     Action.EDIT,   "Editar registros en Producción"),
    (Module.PRODUCTION,     Action.DELETE, "Eliminar registros en Producción"),
    (Module.QUALITY,        Action.VIEW,   "Ver módulo de Calidad"),
    (Module.QUALITY,        Action.CREATE, "Crear registros en Calidad"),
    (Module.QUALITY,        Action.EDIT,   "Editar registros en Calidad"),
    (Module.QUALITY,        Action.DELETE, "Eliminar registros en Calidad"),
    (Module.MAINTENANCE,    Action.VIEW,   "Ver módulo de Mantenimiento"),
    (Module.MAINTENANCE,    Action.CREATE, "Crear registros en Mantenimiento"),
    (Module.MAINTENANCE,    Action.EDIT,   "Editar registros en Mantenimiento"),
    (Module.MAINTENANCE,    Action.DELETE, "Eliminar registros en Mantenimiento"),
    (Module.WAREHOUSE,      Action.VIEW,   "Ver módulo de Almacén"),
    (Module.WAREHOUSE,      Action.CREATE, "Crear registros en Almacén"),
    (Module.WAREHOUSE,      Action.EDIT,   "Editar registros en Almacén"),
    (Module.WAREHOUSE,      Action.DELETE, "Eliminar registros en Almacén"),
    (Module.ADMINISTRATION, Action.VIEW,   "Ver módulo de Administración"),
    (Module.ADMINISTRATION, Action.CREATE, "Crear registros en Administración"),
    (Module.ADMINISTRATION, Action.EDIT,   "Editar registros en Administración"),
    (Module.ADMINISTRATION, Action.DELETE, "Eliminar registros en Administración"),
]

ROLE_DEFINITIONS = [
    {
        "name": "Operator",
        "slug": "operator",
        "description": "Acceso básico de planta — lectura y captura",
        "is_system": True,
        "permissions": [
            "production.view", "production.create",
            "quality.view",
            "maintenance.view",
            "warehouse.view",
        ],
    },
    {
        "name": "Supervisor",
        "slug": "supervisor",
        "description": "Supervisión de planta — acceso completo a módulos operativos",
        "is_system": True,
        "permissions": [
            "production.view", "production.create", "production.edit",
            "quality.view", "quality.create", "quality.edit",
            "maintenance.view", "maintenance.create", "maintenance.edit",
            "warehouse.view", "warehouse.create", "warehouse.edit",
        ],
    },
    {
        "name": "Quality Engineer",
        "slug": "quality_engineer",
        "description": "Ingeniero de Calidad — gestión completa de calidad",
        "is_system": True,
        "permissions": [
            "quality.view", "quality.create", "quality.edit",
            "production.view",
        ],
    },
    {
        "name": "Process Engineer",
        "slug": "process_engineer",
        "description": "Ingeniero de Procesos — gestión de producción",
        "is_system": True,
        "permissions": [
            "production.view", "production.create", "production.edit",
            "quality.view",
        ],
    },
    {
        "name": "Maintenance Engineer",
        "slug": "maintenance_engineer",
        "description": "Ingeniero de Mantenimiento — gestión de activos",
        "is_system": True,
        "permissions": [
            "maintenance.view", "maintenance.create", "maintenance.edit",
            "production.view",
        ],
    },
    {
        "name": "Inventory Engineer",
        "slug": "inventory_engineer",
        "description": "Ingeniero de Inventarios — gestión de almacén",
        "is_system": True,
        "permissions": [
            "warehouse.view", "warehouse.create", "warehouse.edit",
            "production.view",
        ],
    },
    {
        "name": "MES Admin",
        "slug": "admin",
        "description": "Administrador del sistema MES — acceso total",
        "is_system": True,
        "permissions": [
            "production.view", "production.create", "production.edit", "production.delete",
            "quality.view", "quality.create", "quality.edit", "quality.delete",
            "maintenance.view", "maintenance.create", "maintenance.edit", "maintenance.delete",
            "warehouse.view", "warehouse.create", "warehouse.edit", "warehouse.delete",
            "administration.view", "administration.create", "administration.edit", "administration.delete",
        ],
    },
    {
        "name": "Plant Manager",
        "slug": "plant_manager",
        "description": "Gerente de planta — lectura total sin modificaciones",
        "is_system": True,
        "permissions": [
            "production.view", "quality.view",
            "maintenance.view", "warehouse.view", "administration.view",
        ],
    },
]


class PermissionService:

    # ─── Permisos de usuario ──────────────────────────────────────────────────

    @staticmethod
    def get_user_permissions(user) -> dict:
        if user.is_superuser:
            return {
                module: list(Action.values)
                for module in Module.values
            }

        # UNION de permisos de todos los roles del usuario
        perm_keys = set(
            Permission.objects
            .filter(roles__user_roles__user=user)
            .values_list("key", flat=True)
        )

        # Aplicar overrides
        overrides = (
            UserPermissionOverride.objects
            .filter(user=user)
            .select_related("permission")
        )
        for override in overrides:
            if override.override_type == UserPermissionOverride.GRANT:
                perm_keys.add(override.permission.key)
            else:
                perm_keys.discard(override.permission.key)

        # Convertir a dict {module: [actions]}
        result: dict[str, list[str]] = {}
        for key in perm_keys:
            module, action = key.split(".", 1)
            if module not in result:
                result[module] = []
            result[module].append(action)

        return result

    @staticmethod
    def has_permission(user, module: str, action: str) -> bool:
        perms = PermissionService.get_user_permissions(user)
        return action in perms.get(module, [])

    # ─── Overrides por usuario ────────────────────────────────────────────────

    @staticmethod
    def set_user_override(user, permission_key: str, override_type: str) -> None:
        permission = Permission.objects.get(key=permission_key)
        UserPermissionOverride.objects.update_or_create(
            user=user,
            permission=permission,
            defaults={"override_type": override_type},
        )

    @staticmethod
    def remove_user_override(user, permission_key: str) -> None:
        Permission.objects.filter(key=permission_key).first()
        UserPermissionOverride.objects.filter(
            user=user,
            permission__key=permission_key,
        ).delete()

    # ─── Permisos de rol ──────────────────────────────────────────────────────

    @staticmethod
    def get_role_permissions(role_slug: str) -> list[str]:
        return list(
            Permission.objects
            .filter(roles__slug=role_slug)
            .values_list("key", flat=True)
            .order_by("key")
        )

    @staticmethod
    def set_role_permissions(role_slug: str, permission_keys: list[str]) -> None:
        role = Role.objects.get(slug=role_slug)
        permissions = Permission.objects.filter(key__in=permission_keys)
        with transaction.atomic():
            RolePermission.objects.filter(role=role).delete()
            RolePermission.objects.bulk_create([
                RolePermission(role=role, permission=p)
                for p in permissions
            ])

    # ─── Seed ─────────────────────────────────────────────────────────────────

    @staticmethod
    def seed_permissions() -> None:
        for module, action, description in PERMISSION_DEFINITIONS:
            key = f"{module}.{action}"
            Permission.objects.update_or_create(
                key=key,
                defaults={"module": module, "action": action, "description": description},
            )

    @staticmethod
    def seed_roles() -> None:
        for role_def in ROLE_DEFINITIONS:
            role, _ = Role.objects.update_or_create(
                slug=role_def["slug"],
                defaults={
                    "name": role_def["name"],
                    "description": role_def["description"],
                    "is_system": role_def["is_system"],
                },
            )
            permissions = Permission.objects.filter(key__in=role_def["permissions"])
            with transaction.atomic():
                RolePermission.objects.filter(role=role).delete()
                RolePermission.objects.bulk_create([
                    RolePermission(role=role, permission=p)
                    for p in permissions
                ])

    @staticmethod
    def seed_all() -> None:
        PermissionService.seed_permissions()
        PermissionService.seed_roles()

    # ─── Asignación de roles a usuarios ──────────────────────────────────────

    @staticmethod
    def assign_role(user, role_slug: str) -> None:
        role = Role.objects.get(slug=role_slug)
        UserRole.objects.get_or_create(user=user, role=role)

    @staticmethod
    def remove_role(user, role_slug: str) -> None:
        UserRole.objects.filter(user=user, role__slug=role_slug).delete()

    @staticmethod
    def set_user_roles(user, role_slugs: list[str]) -> None:
        roles = Role.objects.filter(slug__in=role_slugs)
        with transaction.atomic():
            UserRole.objects.filter(user=user).delete()
            UserRole.objects.bulk_create([
                UserRole(user=user, role=role)
                for role in roles
            ])

    # ─── Migración legacy ────────────────────────────────────────────────────

    @staticmethod
    def migrate_legacy_roles() -> None:
        from apps.identity.models import User

        LEGACY_MAP = {
            "operador":   "operator",
            "tecnico":    "operator",
            "lider":      "supervisor",
            "supervisor": "supervisor",
            "ingeniero":  "process_engineer",
            "admin":      "admin",
            "gerente":    "plant_manager",
        }

        users = User.objects.filter(role__isnull=False).exclude(role="")
        for user in users:
            slug = LEGACY_MAP.get(user.role)
            if slug:
                try:
                    role = Role.objects.get(slug=slug)
                    UserRole.objects.get_or_create(user=user, role=role)
                except Role.DoesNotExist:
                    pass