from django.db import models
from django.conf import settings
from .question_template import ChatbotQuestionTemplate


class ChatbotFeedback(models.Model):
    template = models.ForeignKey(
        ChatbotQuestionTemplate,
        on_delete=models.CASCADE,
        related_name="feedback_entries",
    )
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        null=True,
        on_delete=models.SET_NULL,
        related_name="chatbot_feedback",
    )
    was_helpful = models.BooleanField()
    filters_snapshot = models.JSONField(default=dict, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = "quality_chatbot_feedback"
        ordering = ["-created_at"]
        verbose_name = "Chatbot: Feedback"
        verbose_name_plural = "Chatbot: Feedback"

    def __str__(self):
        return f"{self.template.question_key} — {'👍' if self.was_helpful else '👎'}"


class ChatbotSuggestion(models.Model):
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        null=True,
        on_delete=models.SET_NULL,
        related_name="chatbot_suggestions",
    )
    module = models.CharField(max_length=50, default="qwall")
    suggestion_text = models.TextField()
    created_at = models.DateTimeField(auto_now_add=True)
    reviewed = models.BooleanField(default=False)

    class Meta:
        db_table = "quality_chatbot_suggestion"
        ordering = ["-created_at"]
        verbose_name = "Chatbot: Sugerencia"
        verbose_name_plural = "Chatbot: Sugerencias"

    def __str__(self):
        return f"{self.user} — {self.suggestion_text[:50]}"