"use node";

/// <reference types="node" />

/** Minimal env typing so this file also type-checks from the Vite app. */
declare const process: {
  env: Record<string, string | undefined>;
};

import { action } from "./_generated/server";
import { internal } from "./_generated/api";
import { v } from "convex/values";
import { ConvexError } from "convex/values";
import { requireFuncKey } from "./botFunc";

const DISCORD_API = "https://discord.com/api/v10";
const PERM_MANAGE_GUILD = 0x20;

/**
 * Rate-limit login attempt (in-memory, 60s window): IP-based bucket keyed from
 * the Convex request. Without this, anyone can spam bogus codes → each attempt
 * burns a Discord API roundtrip + writes; a botnet could drain quota and get
 * the deployment's Discord OAuth client flagged.
 * (Best-effort: in-memory only survives one action instance — enough against
 * scripted bursts, same approach as haimiya:ask.)
 */
const loginBuckets = new Map<string, { calls: number[] }>();
const LOGIN_WINDOW_MS = 60_000;
const LOGIN_MAX_PER_WINDOW = 20;

function assertLoginRateLimit(identity: string): void {
  const now = Date.now();
  const bucket = loginBuckets.get(identity);
  if (bucket) {
    bucket.calls = bucket.calls.filter((t) => now - t < LOGIN_WINDOW_MS);
    if (bucket.calls.length >= LOGIN_MAX_PER_WINDOW) {
      throw new ConvexError("Quá nhiều lượt đăng nhập — thử lại sau ít phút");
    }
    bucket.calls.push(now);
  } else {
    loginBuckets.set(identity, { calls: [now] });
    if (loginBuckets.size > 500) {
      for (const [k, b] of loginBuckets) {
        if (b.calls.every((t) => now - t > LOGIN_WINDOW_MS)) loginBuckets.delete(k);
      }
    }
  }
}

/**
 * redirect_uri phải khớp CHÍNH XÁC một trong những URL đăng ký trong Discord
 * Developer Portal (/discord/callback trên domain dashboard). Chặn kẻ xấu trao đổi
 * code theo redirect_uri tùy ý ( authorization code bị kẹp có thể bị gửi tới
 * endpoint attacker-controlled và trao đổi thành access token).
 */
function assertAllowedRedirectUri(uri: string): void {
  const ALLOWED = [
    process.env.OAUTH_REDIRECT_URI,
    process.env.DASHBOARD_URL
      ? `${process.env.DASHBOARD_URL.replace(/\/+$/, "")}/discord/callback`
      : undefined,
  ].filter((u): u is string => !!u);
  if (ALLOWED.length === 0) return; // chưa cấu hình → giữ back-compat (như trước đây)
  if (!ALLOWED.includes(uri)) {
    throw new ConvexError("redirect_uri không nằm trong danh sách cho phép");
  }
}

/**
 * Trao đổi code → access token bằng client_secret (đường chính). Mọi lỗi trả
 * ConvexError để browser thấy thông báo thật thay vì "Server Error" bị mask.
 */
async function exchangeWithSecret(
  clientId: string,
  clientSecret: string,
  code: string,
  codeVerifier: string,
  redirectUri: string,
): Promise<string> {
  const body = new URLSearchParams({
    client_id: clientId,
    client_secret: clientSecret,
    grant_type: "authorization_code",
    code,
    redirect_uri: redirectUri,
    code_verifier: codeVerifier,
  });
  const res = await fetch(`${DISCORD_API}/oauth2/token`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new ConvexError(`Discord token API lỗi ${res.status}: ${text.slice(0, 120)}`);
  }
  const data = (await res.json()) as { access_token?: string };
  if (!data.access_token) throw new ConvexError("Discord không trả access token");
  return data.access_token;
}

/**
 * Trao đổi code OAuth Discord + tạo phiên đăng nhập NGAY TRÊN SERVER.
 *
 * Trước đây web tự gọi Discord API bằng clientId công khai (PKCE không cần
 * client_secret) rồi TỰ báo user + danh sách server lên `sessions:login` —
 * kẻ xấu có thể tự gọi mutation này và GIẢ MẠ bất kỳ danh tính nào (lấy quyền
 * quản lý mọi server). Giờ:
 *  1. Web chỉ gửi `code` + `codeVerifier` (PKCE) lên action này.
 *  2. Server tự gọi Discord token endpoint (kèm client_secret), rồi hỏi
 *     Discord `/users/@me` + `/users/@me/guilds` — danh tính HOÀN TOÀN từ
 *     Discord, client không thể giả mạo.
 *  3. Server tự tạo session token (random 32 byte) và ghi vào bảng sessions,
 *     trả { token, user, guilds } cho web lưu.
 *
 * funcKey: action này dùng DISCORD_CLIENT_SECRET (env) — cần chìa khóa để
 * tránh bị lạm dụng. Chưa đặt FUNC_SEED → miễn check (back-compat).
 */
export const exchangeAndLogin = action({
  args: {
    code: v.string(),
    codeVerifier: v.string(),
    redirectUri: v.string(),
    funcKey: v.optional(v.string()),
    /**
     * Fallback (15/09): deployment thiếu DISCORD_CLIENT_SECRET → web tự trao đổi
     * code bằng PKCE (không cần secret) và gửi access token lên. Server KHÔNG tin
     * token này: gọi ngay /users/@me xác thực với Discord — danh tính vẫn hoàn
     * toàn từ Discord, không thể giả mạo nếu không giữ code+verifier thật.
     */
    accessToken: v.optional(v.string()),
  },
  handler: async (ctx, { code, codeVerifier, redirectUri, funcKey, accessToken }) => {
    requireFuncKey(funcKey, process.env.FUNC_SEED);
    assertAllowedRedirectUri(redirectUri);
    // Chặn spam code giả trước khi đụng tới Discord API (tiết kiệm quota + tránh flag OAuth client).
    assertLoginRateLimit(
      process.env.FUNC_SEED && funcKey ? "func:" + funcKey.slice(0, 16) : "public",
    );

    const clientId = process.env.DISCORD_CLIENT_ID;
    const clientSecret = process.env.DISCORD_CLIENT_SECRET;

    // 1. Access token: từ fallback (PKCE client-side) hoặc trao đổi server-side.
    // ConvexError (không phải Error thường): prod Convex MASK thông báo Error
    // thường thành "Server Error" — người dùng không bao giờ biết lý do thật.
    let accessTokenValue: string;
    if (accessToken) {
      accessTokenValue = accessToken;
    } else {
      if (!clientId) {
        throw new ConvexError(
          "DISCORD_CLIENT_ID chưa được cấu hình trên deployment — thêm trong Keys/API keys",
        );
      }
      if (!clientSecret) {
        throw new ConvexError("NEED_CLIENT_SECRET_EXCHANGE");
      }
      accessTokenValue = await exchangeWithSecret(
        clientId,
        clientSecret,
        code,
        codeVerifier,
        redirectUri,
      );
    }

    // 2. Lấy danh tính + danh sách server NGAY TỪ DISCORD — không tin client
    const authHeaders = { Authorization: `Bearer ${accessTokenValue}` };
    const [userRes, guildsRes] = await Promise.all([
      fetch(`${DISCORD_API}/users/@me`, { headers: authHeaders }),
      fetch(`${DISCORD_API}/users/@me/guilds`, { headers: authHeaders }),
    ]);
    if (!userRes.ok) {
      throw new ConvexError(`Không lấy được thông tin người dùng (${userRes.status})`);
    }
    const user = (await userRes.json()) as {
      id: string;
      username: string;
      global_name?: string | null;
      avatar?: string | null;
    };
    const guilds = guildsRes.ok
      ? ((await guildsRes.json()) as {
          id: string;
          name: string;
          icon?: string | null;
          permissions: string;
        }[])
      : [];

    // 3. Tạo session token phía server và đăng nhập (internal mutation — client không gọi được)
    const tokenBytes = new Uint8Array(32);
    crypto.getRandomValues(tokenBytes);
    const token = btoa(String.fromCharCode(...tokenBytes))
      .replace(/\+/g, "-")
      .replace(/\//g, "_")
      .replace(/=+$/, "");
    await ctx.runMutation(internal.sessionHardening.loginInternal, {
      token,
      user: {
        discordId: user.id,
        username: user.username,
        globalName: user.global_name ?? undefined,
        avatar: user.avatar ?? undefined,
      },
      guilds: guilds.map((g) => ({
        id: g.id,
        name: g.name,
        icon: g.icon ?? undefined,
        permissions: g.permissions,
      })),
    });

    return {
      token,
      user: {
        discordId: user.id,
        username: user.username,
        globalName: user.global_name ?? undefined,
        avatar: user.avatar ?? undefined,
      },
      guilds: guilds.map((g) => ({
        id: g.id,
        name: g.name,
        icon: g.icon ?? undefined,
        permissions: g.permissions,
      })),
      manageableCount: guilds.filter(
        (g) => (BigInt(g.permissions) & BigInt(PERM_MANAGE_GUILD)) !== 0n,
      ).length,
      accessToken: accessTokenValue,
    };
  },
});

/**
 * Làm mới danh sách server NGAY TỪ DISCORD — không tin client.
 * Trước đây `sessions:refreshGuilds` nhận danh sách guilds do client tự báo →
 * người dùng đã đăng nhập có thể tự nhận quyền Manage Server trên BẤT KỲ guild
 * nào bằng cách gửi permissions giả. Giờ web chỉ gửi session token + Discord
 * access token; server tự gọi /users/@me/guilds và ghi danh sách thật.
 */
export const refreshGuildsServer = action({
  args: {
    /** Session token của người dùng (đã đăng nhập qua exchangeAndLogin). */
    token: v.string(),
    /** Discord OAuth access token còn hạn (web lưu sau đăng nhập). */
    accessToken: v.string(),
  },
  handler: async (ctx, { token, accessToken }) => {
    const me = await ctx.runQuery(internal.sessionHardening.getUserByTokenInternal, { token });
    if (!me) return { ok: false as const, reason: "not_logged_in" as const };

    let guilds: { id: string; name: string; icon?: string; permissions: string }[];
    try {
      const res = await fetch(`${DISCORD_API}/users/@me/guilds`, {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      if (!res.ok) return { ok: false as const, reason: "discord_error" as const };
      const raw = (await res.json()) as {
        id: string;
        name: string;
        icon?: string | null;
        permissions: string;
      }[];
      guilds = raw.map((g) => ({
        id: g.id,
        name: g.name,
        icon: g.icon ?? undefined,
        permissions: g.permissions,
      }));
    } catch {
      return { ok: false as const, reason: "network" as const };
    }

    await ctx.runMutation(internal.sessionHardening.guildsInternal, {
      discordId: me.discordId,
      guilds,
    });
    return {
      ok: true as const,
      manageableCount: guilds.filter(
        (g) => (BigInt(g.permissions) & BigInt(PERM_MANAGE_GUILD)) !== 0n,
      ).length,
    };
  },
});
