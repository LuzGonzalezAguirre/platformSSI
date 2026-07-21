import apiClient from "../../../services/api.client";

export interface ChatbotAnswer {
  question_key: string;
  question: string;
  response_type: "text" | "media_list";
  answer?: string;
  media?: unknown;
}

export interface ChatbotPreloadedResponse {
  module: string;
  items: ChatbotAnswer[];
}

export const ChatbotService = {
  getPreloaded: async (module: string, locale: string): Promise<ChatbotPreloadedResponse> => {
    const { data } = await apiClient.get<ChatbotPreloadedResponse>(
      "/quality/chatbot/preloaded/",
      { params: { module, locale } }
    );
    return data;
  },

  submitFeedback: async (questionKey: string, wasHelpful: boolean): Promise<void> => {
    await apiClient.post("/quality/chatbot/feedback/", {
      question_key: questionKey,
      was_helpful: wasHelpful,
    });
  },

  submitSuggestion: async (module: string, suggestionText: string): Promise<void> => {
    await apiClient.post("/quality/chatbot/suggestion/", {
      module,
      suggestion_text: suggestionText,
    });
  },
};