import { useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";

export interface BotStatus {
  online: boolean;
  guildCount: number;
  memberCount: number;
  lastHeartbeat: number | null;
  ownerName: string | null;
  ownerAvatarUrl: string | null;
}

/** Trạng thái bot tổng thể + thông tin chủ bot (bot tự đồng bộ 24/7 từ Discord). */
export function useBotStatus(): BotStatus | null {
  const data = useQuery(api.status.botStatus);
  if (data === undefined) return null;
  return {
    online: !!data.online,
    guildCount: data.guildCount ?? 0,
    memberCount: data.memberCount ?? 0,
    lastHeartbeat: data.lastHeartbeat ?? null,
    ownerName: data.ownerName ?? null,
    ownerAvatarUrl: data.ownerAvatarUrl ?? null,
  };
}
