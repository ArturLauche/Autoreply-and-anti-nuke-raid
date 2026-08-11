import { useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";

export interface Branding {
  botAvatarUrl: string | null;
  haimiyaAvatarUrl: string | null;
}

/**
 * Avatar tùy chỉnh của bot & Haimiya (do admin sở hữu bot đặt trong
 * Tính năng ẩn → Tùy chỉnh giao diện). Trả về null khi đang tải.
 */
export function useBranding(): Branding | null {
  const data = useQuery(api.hidden.getBotBranding);
  if (data === undefined) return null;
  return {
    botAvatarUrl: data.botAvatarUrl ?? null,
    haimiyaAvatarUrl: data.haimiyaAvatarUrl ?? null,
  };
}
