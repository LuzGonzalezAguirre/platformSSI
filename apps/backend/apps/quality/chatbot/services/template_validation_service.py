import re
from typing import Any

from ..registry import CHATBOT_SERVICE_REGISTRY


class ChatbotTemplateValidationError(Exception):
    pass


class ChatbotTemplateValidationService:

    @staticmethod
    def extract_template_variables(template_text: str) -> set[str]:
        return set(re.findall(r"\{(\w+)\}", template_text or ""))

    @staticmethod
    def validate_template(
        service_method_ref: str,
        response_type: str,
        answer_template_es: str,
        answer_template_en: str,
    ) -> None:
        intent = CHATBOT_SERVICE_REGISTRY.get(service_method_ref)
        if intent is None:
            raise ChatbotTemplateValidationError(
                f"'{service_method_ref}' no existe en CHATBOT_SERVICE_REGISTRY."
            )

        if response_type == "media_list":
            # No se valida interpolación de variables en texto — el response_type
            # media_list no usa answer_template para renderizar.
            return

        for locale, template in [("es", answer_template_es), ("en", answer_template_en)]:
            if not template.strip():
                raise ChatbotTemplateValidationError(
                    f"answer_template_{locale} no puede estar vacío para response_type='text'."
                )
            used_vars = ChatbotTemplateValidationService.extract_template_variables(template)
            unknown = used_vars - intent.output_fields
            if unknown:
                raise ChatbotTemplateValidationError(
                    f"Variables {unknown} en answer_template_{locale} no existen en el "
                    f"output de '{service_method_ref}'. Disponibles: {intent.output_fields or '(ninguna)'}"
                )

    @staticmethod
    def revalidate_all_active(model_cls) -> list[tuple[Any, str]]:
        """
        Revalida todos los templates activos contra el registry actual.
        Retorna lista de tuplas (template, error_message) para los que fallaron.
        No modifica nada — quien llama decide qué hacer con los rotos.
        """
        broken = []
        for template in model_cls.objects.filter(is_active=True):
            try:
                ChatbotTemplateValidationService.validate_template(
                    template.service_method_ref,
                    template.response_type,
                    template.answer_template_es,
                    template.answer_template_en,
                )
            except ChatbotTemplateValidationError as e:
                broken.append((template, str(e)))
        return broken