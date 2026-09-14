import { internalMutation } from "./_generated/server";
import { v } from "convex/values";
import { getBotStatus } from "./hidden";

/**
 * LƯU CHÌA KHÓA BOT (bootstrap) — phần V8 của cơ chế tự cấp phát botKey.
 *
 * Đóng cửa hậu "botKeySeed chưa đặt thì mọi function bot-side mở cho ai gọi
 * được" (requireBotKey back-compat cũ). Kẻ tấn công chỉ cần seed chưa đặt là
 * đọc được trộm toàn bộ backup JSON (botGetPending trả backupJson thô), giả
 * mạo heartbeat/backup, phóng chủ sở hữu bot (botSetOwner)…
 *
 * Phần "use node" (xác minh Discord token + sinh key) xem botBootstrapAction.ts.
 * Luồng: bot thật gọi action public `botBootstrapAction:requestBotKey` với
 * DISCORD_TOKEN → xác minh qua Discord API → key random 32 bytes → server chỉ
 * lưu BĂM SHA-256(botKey) ở đây. Server KHÔNG lưu key thô — chỉ bot giữ.
 */

/** Chống xoay key dồn dập: 2 lần bootstrap thành công cách nhau tối thiểu 60s. */
const BOOTSTRAP_COOLDOWN_MS = 60_000;
/** Chống dùng action public làm relay spam Discord API: 1 lần THỬ / 10 phút. */
const ATTEMPT_COOLDOWN_MS = 10 * 60_000;

/**
 * Ghi nhận lượt THỬ bootstrap (kể cả thất bại) — chặn relay spam trước khi
 * action gọi Discord API. Trả về lỗi nếu còn trong cửa sổ cooldown.
 */
export const markBootstrapAttempt = internalMutation({
  args: {},
  handler: async (ctx) => {
    const status = await getBotStatus(ctx);
    const now = Date.now();
    const lastAttempt = status?.lastBootstrapAttemptAt ?? 0;
    const lastSuccess = status?.lastBootstrapAt ?? 0;
    // Cho phép ngay khi lượt gần nhất là bootstrap THÀNH CÔNG (lastSuccess ≥ lastAttempt):
    // seed vừa bị thay (đặt seed thủ công mới / xoay key) → bot phải cấp phát lại được ngay,
    // không bị kẹt cửa 10 phút. Cửa 10 phút chỉ áp dụng cho chuỗi THẤT BẠI liên tiếp.
    const gateOpen = !status || lastSuccess >= lastAttempt;
    if (!gateOpen && now - lastAttempt < ATTEMPT_COOLDOWN_MS) {
      const waitSec = Math.ceil((ATTEMPT_COOLDOWN_MS - (now - lastAttempt)) / 1000);
      return {
        ok: false as const,
        error: `Vừa thử bootstrap gần đây — thử lại sau ${waitSec} giây`,
      };
    }
    if (status) {
      await ctx.db.patch(status._id, { lastBootstrapAttemptAt: now });
    } else {
      await ctx.db.insert("botStatus", {
        kind: "status",
        online: false,
        guildCount: 0,
        memberCount: 0,
        lastHeartbeat: now,
        startedAt: now,
        version: "",
        lastBootstrapAttemptAt: now,
      });
    }
    return { ok: true as const };
  },
});

/** Lưu BĂM botKey sau khi bot thật đã qua xác minh Discord. */
export const storeBotKeySeed = internalMutation({
  args: { seed: v.string(), botApplicationId: v.optional(v.string()) },
  handler: async (ctx, { seed, botApplicationId }) => {
    const status = await getBotStatus(ctx);
    const now = Date.now();
    if (status && now - (status.lastBootstrapAt ?? 0) < BOOTSTRAP_COOLDOWN_MS) {
      return {
        ok: false as const,
        error: "Vừa bootstrap thành công gần đây — thử lại sau ít phút",
      };
    }
    const patch: Record<string, unknown> = { botKeySeed: seed, lastBootstrapAt: now };
    if (botApplicationId && /^\d{15,20}$/.test(botApplicationId)) {
      patch.botApplicationId = botApplicationId;
    }
    if (status) {
      await ctx.db.patch(status._id, patch);
    } else {
      await ctx.db.insert("botStatus", {
        kind: "status",
        online: false,
        guildCount: 0,
        memberCount: 0,
        lastHeartbeat: now,
        startedAt: now,
        version: "",
        ...patch,
      });
    }
    return { ok: true as const };
  },
});
