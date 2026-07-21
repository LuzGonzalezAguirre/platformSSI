from datetime import date
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated

from .services.chatbot_service import ChatbotService

from .serializers import ChatbotFeedbackCreateSerializer, ChatbotSuggestionCreateSerializer



class ChatbotPreloadedView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        module = request.query_params.get("module")
        if not module:
            return Response({"detail": "El parámetro 'module' es requerido."}, status=400)

        filters = {}

        bu_id = request.query_params.get("bu_id")
        if bu_id:
            filters["bu_id"] = int(bu_id)

        date_from = request.query_params.get("date_from")
        if date_from:
            filters["date_from"] = date.fromisoformat(date_from)

        date_to = request.query_params.get("date_to")
        if date_to:
            filters["date_to"] = date.fromisoformat(date_to)

        filters["locale"] = request.query_params.get("locale", "es")

        answers = ChatbotService.get_preloaded_answers(module, filters, request.user)
        return Response({"module": module, "items": answers})
    
class ChatbotFeedbackCreateView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request):
        serializer = ChatbotFeedbackCreateSerializer(
            data=request.data, context={"request": request}
        )
        serializer.is_valid(raise_exception=True)
        serializer.save()
        return Response({"detail": "Feedback registrado."}, status=201)


class ChatbotSuggestionCreateView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request):
        serializer = ChatbotSuggestionCreateSerializer(
            data=request.data, context={"request": request}
        )
        serializer.is_valid(raise_exception=True)
        serializer.save()
        return Response({"detail": "Sugerencia registrada."}, status=201)