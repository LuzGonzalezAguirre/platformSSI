export interface AppNotification {
  id: number;
  notification_type: string;
  title: string;
  message: string;
  module: string;
  entity_type: string;
  entity_id: number | null;
  action_url: string;
  metadata: Record<string, unknown>;
  is_task: boolean;
  is_pending: boolean;
  read_at: string | null;
  resolved_at: string | null;
  created_at: string;
}

export interface NotificationFeed {
  results: AppNotification[];
  counts: {
    unread: number;
    pending: number;
  };
}

export type NotificationScope = "all" | "pending";
