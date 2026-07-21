from django.urls import path
from apps.quality.chatbot.views import (
    ChatbotPreloadedView,
    ChatbotFeedbackCreateView,
    ChatbotSuggestionCreateView,
)

urlpatterns = [
    path("preloaded/", ChatbotPreloadedView.as_view(), name="chatbot-preloaded"),
    path("feedback/", ChatbotFeedbackCreateView.as_view(), name="chatbot-feedback"),
    path("suggestion/", ChatbotSuggestionCreateView.as_view(), name="chatbot-suggestion"),
]