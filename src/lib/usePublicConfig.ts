import { useEffect, useState } from "react";
import { useAction } from "convex/react";
import { api } from "../../convex/_generated/api";

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

const CACHE_TTL_MS = 10 * 60_000;

let cache: { data: PublicConfig; at: number } | null = null;
let inflight: Promise<PublicConfig> | null = null;

async function fetchConfig(load: () => Promise<Partial<PublicConfig> | null>): Promise<PublicConfig> {
  if (cache && Date.now() - cache.at < CACHE_TTL_MS) return cache.data;
  if (!inflight) {
    inflight = load()
      .then((res) => {
        const data: PublicConfig = {
          clientId: res?.clientId ?? "",
          discordInvite: res?.discordInvite ?? FALLBACK.discordInvite,
          facebookUrl: res?.facebookUrl ?? FALLBACK.facebookUrl,
        };
        cache = { data, at: Date.now() };
        return data;
      })
      .catch(() => {
        // Backend down: dùng fallback nhưng KHÔNG cache lỗi — lần sau thử lại.
        return FALLBACK;
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
    cache ? cache.data : null,
  );
  const [error, setError] = useState(false);
  useEffect(() => {
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
    clientId: config?.clientId ?? "",
    discordInvite: config?.discordInvite ?? FALLBACK.discordInvite,
    facebookUrl: config?.facebookUrl ?? FALLBACK.facebookUrl,
    loading: config === null,
    error,
  };
}
