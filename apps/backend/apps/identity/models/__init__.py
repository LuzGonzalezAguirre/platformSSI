from django.contrib.auth.models import AbstractUser, BaseUserManager
from django.db import models


class UserManager(BaseUserManager):
    def create_user(self, employee_id, password=None, **extra_fields):
        if not employee_id:
            raise ValueError("El número de empleado es obligatorio")
        user = self.model(employee_id=employee_id, **extra_fields)
        user.set_password(password)
        user.save(using=self._db)
        return user

    def create_superuser(self, employee_id, password=None, **extra_fields):
        extra_fields.setdefault("is_staff", True)
        extra_fields.setdefault("is_superuser", True)
        return self.create_user(employee_id, password, **extra_fields)


class User(AbstractUser):
    username = None

    employee_id = models.CharField(
        max_length=20,
        unique=True,
        verbose_name="Número de Empleado",
    )
    roles = models.ManyToManyField(
        "permissions.Role",
        through="permissions.UserRole",
        related_name="users",
        blank=True,
        verbose_name="Roles",
    )
    plant = models.CharField(
        max_length=100,
        blank=True,
        verbose_name="Planta",
    )
    preferred_language = models.CharField(
        max_length=10,
        choices=[("es", "Español"), ("en", "English")],
        default="es",
        verbose_name="Idioma preferido",
    )
    preferred_theme = models.CharField(
        max_length=10,
        default="system",
        choices=[("light", "Light"), ("dark", "Dark"), ("system", "System")],
    )
    timezone = models.CharField(
        max_length=60,
        default="America/Tijuana",
        verbose_name="Zona horaria",
    )
    last_login_at = models.DateTimeField(
        null=True,
        blank=True,
        verbose_name="Último acceso",
    )
    is_active = models.BooleanField(default=True)
    avatar = models.ImageField(
        upload_to="avatars/",
        null=True,
        blank=True,
    )

    objects = UserManager()

    USERNAME_FIELD = "employee_id"
    REQUIRED_FIELDS = []

    class Meta:
        db_table = "identity_user"
        verbose_name = "Usuario"
        verbose_name_plural = "Usuarios"

    def __str__(self):
        return f"{self.employee_id} — {self.full_name}"

    @property
    def full_name(self) -> str:
        return f"{self.first_name} {self.last_name}".strip() or self.employee_id

    @property
    def role_display(self) -> str:
        names = list(self.roles.values_list("name", flat=True))
        return ", ".join(names) if names else "Sin rol"

    @property
    def requires_email(self) -> bool:
        return bool(self.email)