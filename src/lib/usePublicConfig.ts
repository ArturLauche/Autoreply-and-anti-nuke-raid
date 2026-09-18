import { useEffect, useState } from "react";
import { useAction } from "convex/react";
import { api } from "../../convex/_generated/api";
import { pickValidClientId } from "./discord";

/**
 * Cache dùng chung toàn app cho publicConfig (action — tốn hạn mức hơn query).
 * Trước đây mỗi component mount đều gọi lại action → mở 1 trang landing là
 * 3-4 lần gọi liên tiếp. Giờ chỉ gọi MỘT lần trong 10 phút cho cả ứng dụng.
 */
export interface PublicConfig {
  clientId: string;
  discordInvite: string;
  facebookUrl: string;
}

const FALLBACK: PublicConfig = {
  clientId: "",
  discordInvite: "https://discord.gg/rftv",
  facebookUrl: "https://www.facebook.com/profile.php?id=61592820547312",
};

/**
 * Client ID nướng vào bundle lúc build (hosting build có env riêng). Convex
 * deployment có thể KHÔNG có DISCORD_CLIENT_ID (env deployment ≠ env hosting)
 * và bot offline thì không có botApplicationId để fallback — giá trị này cứu
 * nút đăng nhập trong cả 2 trường hợp đó.
 */
const BAKED_CLIENT_ID: string =
  (import.meta.env.VITE_DISCORD_CLIENT_ID as string | undefined) ?? "";

const CACHE_TTL_MS = 10 * 60_000;

let cache: { data: PublicConfig; at: number } | null = null;
let inflight: Promise<PublicConfig> | null = null;

async function fetchConfig(
  load: () => Promise<Partial<PublicConfig> | null>,
): Promise<PublicConfig> {
  if (cache && Date.now() - cache.at < CACHE_TTL_MS) return cache.data;
  if (!inflight) {
    inflight = load()
      .then((res) => {
        const data: PublicConfig = {
          // Chỉ nhận snowflake hợp lệ — giá trị rác (blob mã hóa dán nhầm, chữ,
          // khoảng trắng…) bị loại thay vì đưa vào URL ủy quyền Discord.
          clientId: pickValidClientId(res?.clientId, BAKED_CLIENT_ID),
          discordInvite: res?.discordInvite ?? FALLBACK.discordInvite,
          facebookUrl: res?.facebookUrl ?? FALLBACK.facebookUrl,
        };
        cache = { data, at: Date.now() };
        return data;
      })
      .catch(() => {
        // Backend down: dùng fallback nhưng KHÔNG cache lỗi — lần sau thử lại.
        return { ...FALLBACK, clientId: pickValidClientId(BAKED_CLIENT_ID) };
      })
      .finally(() => {
        inflight = null;
      });
  }
  return inflight;
}

/**
 * Loads the public Discord Client ID (from env) once — deduped across the app.
 *
 * `error` is true when the backend could not be reached at all (so the caller
 * can show a "server unreachable" message instead of blaming a missing
 * Client ID).
 */
export function usePublicConfig(): {
  clientId: string;
  discordInvite: string;
  facebookUrl: string;
  loading: boolean;
  error: boolean;
} {
  const load = useAction(api.public.publicConfig);
  const [config, setConfig] = useState<PublicConfig | null>(
    cache
      ? cache.data
      : pickValidClientId(BAKED_CLIENT_ID)
        ? // Có Client ID nướng trong bundle (production): KHÔNG cần gọi Convex —
          // khách ẩn danh mở landing ≈ 0 Function Call. Ai cần thông tin mới hơn
          // (trường hợp deployment đổi Client ID) vẫn được cache 10 phút phục vụ.
          { ...FALLBACK, clientId: pickValidClientId(BAKED_CLIENT_ID) }
        : null,
  );
  const [error, setError] = useState(false);
  useEffect(() => {
    // Chỉ fetch khi chưa có cache VÀ không có baked ID (dev/preview).
    if (cache || BAKED_CLIENT_ID) return;
    let alive = true;
    fetchConfig(load).then((res) => {
      if (!alive) return;
      // Lỗi chỉ khi chưa từng fetch thành công và fallback clientId rỗng.
      setError(!cache && res.clientId === "");
      setConfig(res);
    });
    return () => {
      alive = false;
    };
  }, [load]);
  return {
    clientId: pickValidClientId(config?.clientId, BAKED_CLIENT_ID),
    discordInvite: config?.discordInvite ?? FALLBACK.discordInvite,
    facebookUrl: config?.facebookUrl ?? FALLBACK.facebookUrl,
    loading: config === null && !pickValidClientId(BAKED_CLIENT_ID),
    error,
  };
}
