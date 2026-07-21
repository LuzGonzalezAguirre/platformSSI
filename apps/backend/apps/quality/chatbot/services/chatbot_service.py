import logging
from ..registry import CHATBOT_SERVICE_REGISTRY

logger = logging.getLogger(__name__)


class ChatbotService:

    @staticmethod
    def get_preloaded_answers(module: str, filters: dict, user) -> list[dict]:
        from ..models import ChatbotQuestionTemplate

        user_role_slugs = set(user.roles.values_list("slug", flat=True))

        templates = ChatbotQuestionTemplate.objects.filter(
            module=module, is_active=True
        ).order_by("display_order")

        locale = filters.get("locale", "es")
        answers = []

        for template in templates:
            if template.role_slugs_allowed and not (
                set(template.role_slugs_allowed) & user_role_slugs
            ):
                continue

            intent = CHATBOT_SERVICE_REGISTRY.get(template.service_method_ref)
            if intent is None:
                logger.warning(
                    "Chatbot template '%s' referencia intent inexistente '%s'",
                    template.question_key, template.service_method_ref,
                )
                continue

            missing = intent.required_filters - set(filters.keys())
            if missing:
                # Filtro requerido no llegó del frontend (ej. bu_id ausente) —
                # se excluye esta pregunta silenciosamente, no es error de config.
                continue

            try:
                data = intent.service_call(filters, template.config_params)
            except Exception:
                logger.exception(
                    "Error resolviendo chatbot intent '%s' para template '%s'",
                    template.service_method_ref, template.question_key,
                )
                continue

            question_text = template.question_es if locale == "es" else template.question_en

            if template.response_type == "media_list":
                answers.append({
                    "question_key": template.question_key,
                    "question": question_text,
                    "response_type": "media_list",
                    "media": data,
                })
            else:
                template_text = (
                    template.answer_template_es if locale == "es"
                    else template.answer_template_en
                )
                try:
                    answer_text = template_text.format(**data)
                except (KeyError, IndexError):
                    logger.exception(
                        "Error interpolando template '%s' con data %s",
                        template.question_key, data,
                    )
                    continue

                answers.append({
                    "question_key": template.question_key,
                    "question": question_text,
                    "response_type": "text",
                    "answer": answer_text,
                })

        return answers