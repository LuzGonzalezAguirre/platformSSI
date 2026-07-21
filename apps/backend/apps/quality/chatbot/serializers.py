from rest_framework import serializers
from .models import ChatbotFeedback, ChatbotSuggestion, ChatbotQuestionTemplate


class ChatbotFeedbackCreateSerializer(serializers.Serializer):
    question_key = serializers.CharField(max_length=100)
    was_helpful = serializers.BooleanField()
    filters_snapshot = serializers.JSONField(required=False, default=dict)

    def validate_question_key(self, value):
        if not ChatbotQuestionTemplate.objects.filter(
            question_key=value, is_active=True
        ).exists():
            raise serializers.ValidationError(
                f"No existe una pregunta activa con question_key='{value}'."
            )
        return value

    def create(self, validated_data):
        template = ChatbotQuestionTemplate.objects.get(
            question_key=validated_data["question_key"]
        )
        return ChatbotFeedback.objects.create(
            template=template,
            user=self.context["request"].user,
            was_helpful=validated_data["was_helpful"],
            filters_snapshot=validated_data.get("filters_snapshot", {}),
        )


class ChatbotSuggestionCreateSerializer(serializers.ModelSerializer):
    class Meta:
        model = ChatbotSuggestion
        fields = ["module", "suggestion_text"]

    def validate_suggestion_text(self, value):
        if not value.strip():
            raise serializers.ValidationError("El texto no puede estar vacío.")
        return value.strip()

    def create(self, validated_data):
        return ChatbotSuggestion.objects.create(
            user=self.context["request"].user,
            **validated_data,
        )