from django.urls import path
from apps.permissions.drf import quality_view
from apps.quality.chatbot.views import (
    ChatbotPreloadedView,
    ChatbotFeedbackCreateView,
    ChatbotSuggestionCreateView,
)

urlpatterns = [
    path("preloaded/", quality_view(ChatbotPreloadedView), name="chatbot-preloaded"),
    path("feedback/", quality_view(ChatbotFeedbackCreateView), name="chatbot-feedback"),
    path("suggestion/", quality_view(ChatbotSuggestionCreateView), name="chatbot-suggestion"),
]