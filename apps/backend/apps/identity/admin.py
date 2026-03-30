from django.contrib import admin
from django.contrib.auth.admin import UserAdmin
from apps.identity.models import User


@admin.register(User)
class CustomUserAdmin(UserAdmin):
    list_display  = ("employee_id", "full_name", "plant", "is_active")
    list_filter   = ("plant", "is_active")
    search_fields = ("employee_id", "first_name", "last_name")
    ordering      = ("employee_id",)

    fieldsets = (
        ("Identificación",       {"fields": ("employee_id", "password")}),
        ("Información Personal", {"fields": ("first_name", "last_name", "email")}),
        ("Planta",               {"fields": ("plant", "preferred_language", "preferred_theme")}),
        ("Permisos",             {"fields": ("is_active", "is_staff", "is_superuser")}),
        ("Fechas",               {"fields": ("last_login", "date_joined")}),
    )

    add_fieldsets = (
        ("Datos de Acceso", {
            "classes": ("wide",),
            "fields": ("employee_id", "password1", "password2"),
        }),
        ("Información Personal", {
            "classes": ("wide",),
            "fields": ("first_name", "last_name", "email", "plant"),
        }),
    )