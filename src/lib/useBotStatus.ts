import { useEffect, useState } from "react";
import { useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import { isHeartbeatFresh } from "./utils";

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
  // botStatus giờ khai báo args (botKey tùy chọn cho script chẩn đoán) — truyền
  // object rỗng từ web; hoặc bỏ qua args nhưng useQuery cần đối số đầy đủ.
  const data = useQuery(api.status.botStatus, {});
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 15_000);
    return () => window.clearInterval(timer);
  }, []);
  if (data === undefined) return null;
  return {
    online: !!data.online && isHeartbeatFresh(data.lastHeartbeat, now),
    guildCount: data.guildCount ?? 0,
    memberCount: data.memberCount ?? 0,
    lastHeartbeat: data.lastHeartbeat ?? null,
    ownerName: data.ownerName ?? null,
    ownerAvatarUrl: data.ownerAvatarUrl ?? null,
  };
}
