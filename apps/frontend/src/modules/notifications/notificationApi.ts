import apiClient from "../../services/api.client";
import type { AppNotification, NotificationFeed, NotificationScope } from "./types";

export const notificationApi = {
  getFeed: async (scope: NotificationScope): Promise<NotificationFeed> => {
    const { data } = await apiClient.get<NotificationFeed>("/notifications/", {
      params: { scope, limit: 30 },
    });
    return data;
  },
  markRead: async (id: number): Promise<AppNotification> => {
    const { data } = await apiClient.post<AppNotification>(`/notifications/${id}/read/`);
    return data;
  },
  markAllRead: async (): Promise<{ updated: number }> => {
    const { data } = await apiClient.post<{ updated: number }>("/notifications/read-all/");
    return data;
  },
};
