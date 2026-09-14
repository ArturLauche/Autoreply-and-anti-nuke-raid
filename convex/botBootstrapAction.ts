"use node";

import { action } from "./_generated/server";
import { v } from "convex/values";
import { internal } from "./_generated/api";
import { computeBotKey } from "./botAuth";

/**
 * TỰ CẤP PHÁT CHÌA KHÓA BOT (bootstrap) — đóng cửa hậu "botKeySeed chưa đặt
 * thì mọi function bot-side mở cho ai gọi được" (requireBotKey back-compat cũ).
 *
 * Luồng:
 *   1. Bot thật (có DISCORD_TOKEN trong .env trên VPS) gọi action PUBLIC này
 *      lúc khởi động. Phải là action public vì bot qua HTTP client không gọi
 *      được function internal (không có deploy key).
 *   2. Action xác minh token với Discord API GET /users/@me → KẺ NGOÀI KHÔNG
 *      CÓ TOKEN BOT → không bao giờ qua bước này. Đây là chốt chặn duy nhất
 *      cần thiết — action public vẫn an toàn.
 *   3. Sinh botKey = 32 bytes ngẫu nhiên (webcrypto) — KHÔNG dùng seed tĩnh,
 *      kẻ đọc được source cũng không tính được key.
 *   4. Lưu CHỈ BĂM SHA-256("protogon-bot-key::" + botKey) vào
 *      botStatus.botKeySeed (qua internal mutation botBootstrap:storeBotKeySeed),
 *      rồi trả botKey về cho bot. Server KHÔNG lưu key thô — chỉ bot giữ.
 *
 * Chống lạm dụng (relay spam Discord API): tối đa 1 lần THỬ/10 phút cho toàn
 * deployment — bot thật chỉ bootstrap khi mất key nên đủ dùng.
 */

/** Xác minh Discord bot token — trả { id, username } hoặc null khi sai/mạng lỗi. */
async function verifyDiscordBotToken(botToken: string) {
  try {
    const res = await fetch("https://discord.com/api/v10/users/@me", {
      headers: { Authorization: `Bot ${botToken.trim()}` },
    });
    if (!res.ok) return null;
    const data = (await res.json()) as { id?: string; bot?: boolean; username?: string };
    if (!data.id || data.bot !== true) return null;
    return { id: data.id, username: data.username ?? "" };
  } catch {
    return null;
  }
}

type BootstrapResult =
  { ok: true; botKey: string; applicationId: string } | { ok: false; error: string };

/**
 * Hex ngẫu nhiên 32 bytes — dùng webcrypto global (có trong cả Node 18+ actions
 * "use node" lẫn V8 runtime) + mã hex thủ công. KHÔNG dùng node:crypto để file
 * vẫn typecheck được trong chương trình TS của web (tsconfig.app không có types node).
 */
function randomHex32(): string {
  const buf = new Uint8Array(32);
  crypto.getRandomValues(buf);
  let out = "";
  for (const b of buf) out += b.toString(16).padStart(2, "0");
  return out;
}

export const requestBotKey = action({
  args: { botToken: v.string() },
  handler: async (ctx, { botToken }): Promise<BootstrapResult> => {
    // Rate-limit TRƯỚC khi gọi Discord API — chặn dùng action làm relay spam.
    const gate = await ctx.runMutation(internal.botBootstrap.markBootstrapAttempt);
    if (!gate.ok) return gate;

    const bot = await verifyDiscordBotToken(botToken);
    if (!bot) {
      return { ok: false as const, error: "Token bot không hợp lệ (Discord từ chối)" };
    }
    const botKey = randomHex32();
    // computeBotKey = SHA-256("protogon-bot-key::" + key) — thuần TS, khớp protocol botAuth.
    const seed = computeBotKey(botKey);
    const stored = await ctx.runMutation(internal.botBootstrap.storeBotKeySeed, {
      seed,
      botApplicationId: bot.id,
    });
    if (!stored.ok) return stored;
    // Bất biến protocol: botKey do bot giữ phải khớp seed vừa lưu.
    if (computeBotKey(botKey) !== seed) {
      return { ok: false as const, error: "Lỗi nội bộ: key và seed không khớp" };
    }
    return { ok: true as const, botKey, applicationId: bot.id };
  },
});

type KeyStatusResult =
  { ok: true; seeded: boolean; applicationId: string | null } | { ok: false; error: string };

/** Bot hỏi trạng thái seed trước khi bootstrap (tránh xoay key vô ích). */
export const keyStatus = action({
  args: { botToken: v.string() },
  handler: async (ctx, { botToken }): Promise<KeyStatusResult> => {
    const bot = await verifyDiscordBotToken(botToken);
    if (!bot) {
      return { ok: false as const, error: "Token bot không hợp lệ (Discord từ chối)" };
    }
    const status = await ctx.runQuery(internal.botAuth.getBotKeyStatusInternal);
    return { ok: true as const, seeded: status.seeded, applicationId: status.botApplicationId };
  },
});
