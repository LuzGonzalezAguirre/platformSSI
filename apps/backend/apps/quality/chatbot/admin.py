from django import forms
from django.contrib import admin, messages
from django.urls import path
from django.shortcuts import redirect

from .models import ChatbotQuestionTemplate, ChatbotFeedback, ChatbotSuggestion
from .registry import get_registry_choices
from .services import ChatbotTemplateValidationService


class ChatbotQuestionTemplateForm(forms.ModelForm):
    service_method_ref = forms.ChoiceField(choices=[])

    class Meta:
        model = ChatbotQuestionTemplate
        fields = "__all__"

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        self.fields["service_method_ref"].choices = get_registry_choices()


@admin.register(ChatbotQuestionTemplate)
class ChatbotQuestionTemplateAdmin(admin.ModelAdmin):
    form = ChatbotQuestionTemplateForm
    list_display = (
        "question_key", "module", "response_type", "is_active", "display_order", "updated_at",
    )
    list_filter = ("module", "response_type", "is_active")
    search_fields = ("question_key", "question_es", "question_en")
    ordering = ("module", "display_order")
    change_list_template = "admin/chatbot/chatbotquestiontemplate_changelist.html"

    fieldsets = (
        (None, {"fields": ("module", "question_key", "is_active", "display_order")}),
        ("Pregunta (i18n)", {"fields": ("question_es", "question_en")}),
        ("Respuesta", {
            "fields": ("response_type", "answer_template_es", "answer_template_en"),
            "description": (
                "Si response_type='media_list', deja las plantillas de texto vacías."
            ),
        }),
        ("Fuente de datos", {"fields": ("service_method_ref", "required_filters", "config_params")}),
        ("Acceso (RBAC)", {"fields": ("role_slugs_allowed",)}),
    )

    def save_model(self, request, obj, form, change):
        if not obj.pk and not obj.created_by_id:
            obj.created_by = request.user
        obj.full_clean()
        super().save_model(request, obj, form, change)

    def get_urls(self):
        urls = super().get_urls()
        custom = [
            path(
                "revalidate-all/",
                self.admin_site.admin_view(self.revalidate_all_view),
                name="chatbot_revalidate_all",
            ),
        ]
        return custom + urls

    def revalidate_all_view(self, request):
        broken = ChatbotTemplateValidationService.revalidate_all_active(
            ChatbotQuestionTemplate
        )

        if broken:
            for template, error in broken:
                template.is_active = False
                template.save(update_fields=["is_active"])
            summary = "; ".join(f"{t.question_key}: {e}" for t, e in broken)
            messages.warning(
                request,
                f"{len(broken)} plantilla(s) desactivadas por incompatibilidad con el "
                f"registry actual — {summary}",
            )
        else:
            total = ChatbotQuestionTemplate.objects.filter(is_active=True).count()
            messages.success(request, f"Revalidación OK — {total} plantillas activas son válidas.")

        return redirect("..")


@admin.register(ChatbotFeedback)
class ChatbotFeedbackAdmin(admin.ModelAdmin):
    list_display = ("template", "user", "was_helpful", "created_at")
    list_filter = ("was_helpful", "template__module")
    readonly_fields = ("template", "user", "was_helpful", "filters_snapshot", "created_at")

    def has_add_permission(self, request):
        return False


@admin.register(ChatbotSuggestion)
class ChatbotSuggestionAdmin(admin.ModelAdmin):
    list_display = ("user", "module", "suggestion_text_short", "reviewed", "created_at")
    list_filter = ("reviewed", "module")
    readonly_fields = ("user", "module", "suggestion_text", "created_at")

    def suggestion_text_short(self, obj):
        return obj.suggestion_text[:80]
    suggestion_text_short.short_description = "Sugerencia"