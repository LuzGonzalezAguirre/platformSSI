from django.db import models
from django.conf import settings


class ChatbotQuestionTemplate(models.Model):
    MODULE_CHOICES = [
        ("qwall", "Q-Wall"),
    ]

    RESPONSE_TYPE_CHOICES = [
        ("text", "Texto"),
        ("media_list", "Lista con imágenes"),
    ]

    module = models.CharField(max_length=50, choices=MODULE_CHOICES, db_index=True)
    question_key = models.SlugField(max_length=100, unique=True)

    question_es = models.CharField(max_length=255)
    question_en = models.CharField(max_length=255)

    # Vacíos si response_type == "media_list"
    answer_template_es = models.TextField(blank=True)
    answer_template_en = models.TextField(blank=True)

    response_type = models.CharField(
        max_length=20, choices=RESPONSE_TYPE_CHOICES, default="text"
    )

    # Debe existir como key en CHATBOT_SERVICE_REGISTRY. Se valida en clean().
    service_method_ref = models.CharField(max_length=100)

    # Filtros que el frontend debe mandar para que esta pregunta se resuelva
    # ej. ["bu_id", "date_from", "date_to"]
    required_filters = models.JSONField(default=list, blank=True)

    # RBAC granular por pregunta. Lista de role__slug permitidos.
    # Lista vacía = visible para cualquiera con acceso al módulo Quality.
    role_slugs_allowed = models.JSONField(default=list, blank=True)

    # Parámetros de configuración editables sin deploy.
    # ej. {"limit": 5} para "últimos N rechazos"
    config_params = models.JSONField(default=dict, blank=True)

    is_active = models.BooleanField(default=True, db_index=True)
    display_order = models.PositiveIntegerField(default=0)

    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name="chatbot_templates_created",
    )
    updated_at = models.DateTimeField(auto_now=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = "quality_chatbot_question_template"
        ordering = ["module", "display_order", "question_key"]
        verbose_name = "Chatbot: Pregunta"
        verbose_name_plural = "Chatbot: Preguntas"

    def __str__(self):
        return f"[{self.module}] {self.question_key}"

    def clean(self):
        from django.core.exceptions import ValidationError
        from ..services.template_validation_service import (
            ChatbotTemplateValidationService,
            ChatbotTemplateValidationError,
        )

        try:
            ChatbotTemplateValidationService.validate_template(
                service_method_ref=self.service_method_ref,
                response_type=self.response_type,
                answer_template_es=self.answer_template_es,
                answer_template_en=self.answer_template_en,
            )
        except ChatbotTemplateValidationError as e:
            raise ValidationError(str(e))