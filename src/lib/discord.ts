export const SESSION_TOKEN_KEY = "wio_session_token";
export const OAUTH_VERIFIER_KEY = "wio_oauth_verifier";
export const OAUTH_STATE_KEY = "wio_oauth_state";
export const REMEMBER_LOGIN_KEY = "wio_remember_login";
export const DISCORD_ACCESS_KEY = "wio_discord_access";

/** Chỉ lưu đăng nhập tối đa 7 ngày khi bật "Lưu đăng nhập". */
export const SESSION_EXPIRY_DAYS = 7;

interface StoredSession {
  t: string;
  e: number; // expiresAt (ms)
}

/** Bật/tắt "Lưu đăng nhập" — chuyển token giữa sessionStorage và localStorage. */
export function setRememberLogin(remember: boolean): void {
  sessionStorage.setItem(REMEMBER_LOGIN_KEY, remember ? "1" : "0");
  const token = getSessionToken();
  if (!token) return;
  if (remember) {
    localStorage.setItem(
      SESSION_TOKEN_KEY,
      JSON.stringify({ t: token, e: Date.now() + SESSION_EXPIRY_DAYS * 86400_000 } as StoredSession),
    );
    sessionStorage.removeItem(SESSION_TOKEN_KEY);
  } else {
    localStorage.removeItem(SESSION_TOKEN_KEY);
    sessionStorage.setItem(SESSION_TOKEN_KEY, token);
  }
}

/**
 * Đọc token phiên: ưu tiên sessionStorage (không lưu đăng nhập) rồi
 * localStorage (có lưu đăng nhập — tự hết hạn sau 7 ngày).
 */
export function getSessionToken(): string {
  const fromSession = sessionStorage.getItem(SESSION_TOKEN_KEY);
  if (fromSession) return fromSession;
  const raw = localStorage.getItem(SESSION_TOKEN_KEY);
  if (!raw) return "";
  try {
    const parsed = JSON.parse(raw) as StoredSession;
    if (parsed && typeof parsed.t === "string" && typeof parsed.e === "number") {
      if (Date.now() > parsed.e) {
        localStorage.removeItem(SESSION_TOKEN_KEY);
        return "";
      }
      return parsed.t;
    }
  } catch {
    // dữ liệu cũ (token thô chưa có hạn) — vẫn chấp nhận.
  }
  return raw;
}

/** Lưu token theo lựa chọn "Lưu đăng nhập" của người dùng. */
export function setSessionToken(token: string): void {
  const remember = sessionStorage.getItem(REMEMBER_LOGIN_KEY) !== "0";
  if (remember) {
    localStorage.setItem(
      SESSION_TOKEN_KEY,
      JSON.stringify({ t: token, e: Date.now() + SESSION_EXPIRY_DAYS * 86400_000 } as StoredSession),
    );
  } else {
    sessionStorage.setItem(SESSION_TOKEN_KEY, token);
  }
}

/** Xóa token ở cả hai nơi. */
export function clearSessionToken(): void {
  localStorage.removeItem(SESSION_TOKEN_KEY);
  sessionStorage.removeItem(SESSION_TOKEN_KEY);
}

const DISCORD_API = "https://discord.com/api/v10";

export const PERM_MANAGE_GUILD = 0x20n;
export const PERM_ADMINISTRATOR = 0x8n;

export function base64UrlEncode(bytes: Uint8Array): string {
  let bin = "";
  bytes.forEach((b) => (bin += String.fromCharCode(b)));
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

export function generateVerifier(): string {
  const bytes = new Uint8Array(48);
  crypto.getRandomValues(bytes);
  return base64UrlEncode(bytes);
}

export async function generateChallenge(verifier: string): Promise<string> {
  const digest = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(verifier),
  );
  return base64UrlEncode(new Uint8Array(digest));
}

export function randomState(): string {
  return base64UrlEncode(crypto.getRandomValues(new Uint8Array(16)));
}

export function redirectUri(): string {
  return `${window.location.origin}/discord/callback`;
}

export function buildAuthorizeUrl(
  clientId: string,
  state: string,
  challenge: string,
): string {
  const params = new URLSearchParams({
    client_id: clientId,
    response_type: "code",
    redirect_uri: redirectUri(),
    scope: "identify guilds",
    state,
    code_challenge: challenge,
    code_challenge_method: "S256",
    prompt: "consent",
  });
  return `https://discord.com/oauth2/authorize?${params.toString()}`;
}

export async function exchangeCode(
  clientId: string,
  code: string,
  verifier: string,
): Promise<{ access_token: string; refresh_token?: string; expires_in?: number }> {
  const body = new URLSearchParams({
    client_id: clientId,
    grant_type: "authorization_code",
    code,
    redirect_uri: redirectUri(),
    code_verifier: verifier,
  });
  const res = await fetch(`${DISCORD_API}/oauth2/token`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });
  if (!res.ok) throw new Error(`Lỗi trao đổi mã OAuth (${res.status})`);
  return res.json();
}

interface StoredDiscordAccess {
  access_token: string;
  refresh_token?: string;
  expires_at: number; // ms
}

/** Lưu access token OAuth để dashboard tự làm mới danh sách server (không cần đăng nhập lại). */
export function storeDiscordAccess(access: {
  access_token: string;
  refresh_token?: string | null;
  expires_in?: number;
}): void {
  const item: StoredDiscordAccess = {
    access_token: access.access_token,
    refresh_token: access.refresh_token ?? undefined,
    expires_at: Date.now() + (access.expires_in ? access.expires_in * 1000 : 7 * 86400_000),
  };
  localStorage.setItem(DISCORD_ACCESS_KEY, JSON.stringify(item));
}

export function clearDiscordAccess(): void {
  localStorage.removeItem(DISCORD_ACCESS_KEY);
}

function readStoredDiscordAccess(): StoredDiscordAccess | null {
  const raw = localStorage.getItem(DISCORD_ACCESS_KEY);
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as StoredDiscordAccess;
    if (parsed && typeof parsed.access_token === "string") return parsed;
  } catch {
    // dữ liệu cũ/hỏng — bỏ qua
  }
  return null;
}

/**
 * Lấy access token Discord còn hạn; nếu hết hạn thì thử refresh bằng
 * refresh_token. Trả về null khi không có token hợp lệ (cần đăng nhập lại).
 */
export async function getDiscordAccessToken(clientId: string): Promise<string | null> {
  const stored = readStoredDiscordAccess();
  if (!stored) return null;
  if (Date.now() < stored.expires_at - 60_000) return stored.access_token;
  if (!stored.refresh_token) return null;
  const body = new URLSearchParams({
    client_id: clientId,
    grant_type: "refresh_token",
    refresh_token: stored.refresh_token,
    scope: "identify guilds",
  });
  const res = await fetch(`${DISCORD_API}/oauth2/token`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });
  if (!res.ok) {
    clearDiscordAccess();
    return null;
  }
  const data = await res.json();
  storeDiscordAccess(data);
  return data.access_token ?? null;
}

export interface DiscordUser {
  id: string;
  username: string;
  global_name?: string | null;
  avatar?: string | null;
}

export interface DiscordGuild {
  id: string;
  name: string;
  icon?: string | null;
  permissions: string;
  owner?: boolean;
}

export async function fetchDiscordUser(accessToken: string): Promise<DiscordUser> {
  const res = await fetch(`${DISCORD_API}/users/@me`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!res.ok) throw new Error(`Không lấy được thông tin user (${res.status})`);
  return res.json();
}

export async function fetchDiscordGuilds(
  accessToken: string,
): Promise<DiscordGuild[]> {
  const res = await fetch(`${DISCORD_API}/users/@me/guilds`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!res.ok) throw new Error(`Không lấy được danh sách server (${res.status})`);
  return res.json();
}

export function hasPermission(permissions: string, bit: bigint): boolean {
  return (BigInt(permissions) & bit) !== 0n;
}

export function discordAvatarUrl(
  user: { id: string; avatar?: string | null },
  size = 128,
): string | null {
  if (!user.avatar) return null;
  const ext = user.avatar.startsWith("a_") ? "gif" : "png";
  return `https://cdn.discordapp.com/avatars/${user.id}/${user.avatar}.${ext}?size=${size}`;
}

export function discordGuildIconUrl(
  guild: { id: string; icon?: string | null },
  size = 128,
): string | null {
  if (!guild.icon) return null;
  const ext = guild.icon.startsWith("a_") ? "gif" : "png";
  return `https://cdn.discordapp.com/icons/${guild.id}/${guild.icon}.${ext}?size=${size}`;
}

export function buildBotInviteUrl(clientId: string): string {
  const params = new URLSearchParams({
    client_id: clientId,
    permissions: "8",
    scope: "bot applications.commands",
  });
  return `https://discord.com/oauth2/authorize?${params.toString()}`;
}

export function newSessionToken(): string {
  const bytes = new Uint8Array(24);
  crypto.getRandomValues(bytes);
  return base64UrlEncode(bytes);
}
