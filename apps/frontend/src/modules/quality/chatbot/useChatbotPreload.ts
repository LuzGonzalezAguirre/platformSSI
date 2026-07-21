import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { ChatbotService } from "./chatbot.service";

export function useChatbotPreload(module: string, enabled: boolean) {
  const { i18n } = useTranslation();
  const locale = i18n.language?.startsWith("en") ? "en" : "es";

  return useQuery({
    queryKey: ["chatbot-preload", module, locale],
    queryFn: () => ChatbotService.getPreloaded(module, locale),
    enabled,
    staleTime: 5 * 60 * 1000, // 5 min, igual al CACHE_TTL del backend
    refetchOnWindowFocus: false,
  });
}