export const DEFAULT_CONVEX_URL = "http://127.0.0.1:3210";

const CONVEX_HOST_RE = /^[a-z0-9-]+(?:\.[a-z0-9-]+)*\.convex\.cloud$/i;
const LOCAL_CONVEX_HOST_RE = /^(?:localhost|127\.0\.0\.1)(?::\d+)?$/i;

/** Chuẩn hóa URL Convex và từ chối origin ngoài allowlist của hosting. */
export function normalizeConvexUrl(raw: string | null | undefined): string | null {
  const value = String(raw ?? "").trim();
  if (!value) return null;
  try {
    const url = new URL(value);
    const isLocal = LOCAL_CONVEX_HOST_RE.test(url.host);
    if (isLocal) {
      if (url.protocol !== "http:" && url.protocol !== "https:") return null;
    } else if (url.protocol !== "https:" || !CONVEX_HOST_RE.test(url.hostname)) {
      return null;
    }
    if (url.username || url.password || url.search || url.hash) return null;
    return `${url.protocol}//${url.host}`;
  } catch {
    return null;
  }
}

/**
 * Một nguồn quyết định duy nhất cho client Convex.
 * URL localhost chỉ hữu ích trong sandbox; production build fail-closed khi env
 * sai thay vì âm thầm trỏ sang deployment public khác.
 */
export function resolveConvexUrl(
  raw: string | null | undefined = import.meta.env.VITE_CONVEX_URL,
): string {
  const configured = normalizeConvexUrl(raw);
  const value = String(raw ?? "").trim();
  if (!value) {
    if (import.meta.env.DEV) return DEFAULT_CONVEX_URL;
    throw new Error("Thiếu CONVEX_URL cho production build");
  }
  if (!configured) throw new Error("CONVEX_URL không hợp lệ hoặc không nằm trong allowlist");
  const isLocal = /^(https?:\/\/)?(localhost|127\.0\.0\.1)(:\d+)?$/i.test(configured);
  if (isLocal && !import.meta.env.DEV) {
    throw new Error("Không dùng CONVEX_URL localhost trong production build");
  }
  return configured;
}

export function convexPingUrl(raw?: string | null): string {
  return `${resolveConvexUrl(raw)}/api/query`;
}
