import { query, mutation } from "./_generated/server";
import { v } from "convex/values";
import { getUserByToken } from "./auth";
import { requireBotKeyStrict } from "./botAuth";

/**
 * Trạng thái tổng thể của bot (công khai, không nhạy cảm): online hay không,
 * số server/thành viên, heartbeat gần nhất, và thông tin chủ bot mà bot tự
 * đồng bộ từ Discord mỗi phút (cập nhật 24/7).
 */
/** Người dùng đang đăng nhập có phải chủ sở hữu bot không (cửa sổ Admin ẩn). */
export const isOwner = query({
  args: { token: v.string() },
  handler: async (ctx, { token }) => {
    const user = await getUserByToken(ctx, token);
    if (!user) return false;
    const status = await ctx.db
      .query("botStatus")
      .withIndex("by_kind", (q) => q.eq("kind", "status"))
      .first();
    return !!status?.ownerDiscordId && status.ownerDiscordId === user.discordId;
  },
});

/** Bot heartbeat — called every 30s to update status (mutation, not action). */
export const heartbeat = mutation({
  args: {
    online: v.boolean(),
    guildCount: v.number(),
    memberCount: v.number(),
    version: v.string(),
    /** Chìa khóa bot (botAuth) — chỉ bot có OWNER_SEED mới tính được. */
    botKey: v.optional(v.string()),
  },
  handler: async (ctx, { botKey, online, guildCount, memberCount, version }) => {
    await requireBotKeyStrict(ctx, botKey);
    const now = Date.now();
    const status = await ctx.db
      .query("botStatus")
      .withIndex("by_kind", (q) => q.eq("kind", "status"))
      .first();
    if (status) {
      await ctx.db.patch(status._id, {
        online,
        guildCount,
        memberCount,
        lastHeartbeat: now,
        version,
      });
    } else {
      await ctx.db.insert("botStatus", {
        kind: "status" as const,
        online,
        guildCount,
        memberCount,
        lastHeartbeat: now,
        startedAt: now,
        version,
      });
    }
    return { ok: true };
  },
});

/**
 * Bot báo khả năng VẼ THẺ ảnh chào của máy chủ (thư viện canvas + font nhúng).
 *
 * Vì sao có đường riêng thay vì đi nhờ botSyncGuilds: dashboard phải biết TRƯỚC
 * khi người dùng bật thẻ rồi thắc mắc sao không thấy ảnh. Không có tín hiệu này
 * thì "thẻ bật" và "thẻ vẽ được" là hai chuyện khác nhau mà web không phân biệt
 * nổi — đúng lớp lỗi im lặng mà dự án này đang chặn.
 *
 * Bot gọi MỘT LẦN lúc khởi động: kết quả nạp module/font được cache trong tiến
 * trình nên không đổi giữa chừng (không tốn function call định kỳ).
 */
export const reportCardCapability = mutation({
  args: {
    ready: v.boolean(),
    reason: v.optional(v.string()),
    /** Chìa khóa bot (botAuth) — chỉ bot có OWNER_SEED mới tính được. */
    botKey: v.optional(v.string()),
  },
  handler: async (ctx, { botKey, ready, reason }) => {
    await requireBotKeyStrict(ctx, botKey);
    const now = Date.now();
    const patch = {
      cardReady: ready,
      // Vẽ được thì xoá lý do cũ (tránh lý do của lần hỏng trước còn nằm lại).
      cardUnavailableReason: ready
        ? undefined
        : String(reason || "Lý do không xác định").slice(0, 200),
    };
    const status = await ctx.db
      .query("botStatus")
      .withIndex("by_kind", (q) => q.eq("kind", "status"))
      .first();
    if (status) {
      await ctx.db.patch(status._id, patch);
    } else {
      await ctx.db.insert("botStatus", {
        kind: "status" as const,
        online: false,
        guildCount: 0,
        memberCount: 0,
        lastHeartbeat: now,
        startedAt: now,
        version: "",
        ...patch,
      });
    }
    return { ok: true, cardReady: ready };
  },
});

/**
 * Sức khỏe AI (đợt 12) — tổng hợp aiStats() bot đẩy lên qua botSyncGuilds.
 * CHỈ owner bot đọc được: cửa sổ Admin là khu vực riêng tư, người dùng thường
 * không được thấy provider/model/đếm verdict (tránh lộ hạ tầng AI cho kẻ xấu).
 */
export const getAiHealth = query({
  args: { token: v.string() },
  handler: async (ctx, { token }) => {
    const user = await getUserByToken(ctx, token);
    if (!user) return null;
    const status = await ctx.db
      .query("botStatus")
      .withIndex("by_kind", (q) => q.eq("kind", "status"))
      .first();
    if (!status?.ownerDiscordId || status.ownerDiscordId !== user.discordId) return null;
    const ai = status.aiHealth;
    if (!ai) return null;
    // Bot ngừng sync quá 3 phút → số liệu cũ coi như mất kết nối (không hiển thị).
    if (Date.now() - status.lastHeartbeat > 180_000) return { stale: true, ...ai };
    return { stale: false, ...ai };
  },
});

export const botStatus = query({
  // botKey: script chẩn đoán chèn chìa khóa vào mọi call — bỏ qua an toàn ở đây
  // (đây là query công khai, không nhạy cảm).
  args: { botKey: v.optional(v.string()) },
  handler: async (ctx, _args) => {
    const status = await ctx.db
      .query("botStatus")
      .withIndex("by_kind", (q) => q.eq("kind", "status"))
      .first();
    if (!status) {
      return {
        online: false,
        guildCount: 0,
        memberCount: 0,
        lastHeartbeat: null,
        ownerName: null,
        ownerAvatarUrl: null,
      };
    }
    return {
      online: status.online && Date.now() - status.lastHeartbeat < 180_000,
      guildCount: status.guildCount,
      memberCount: status.memberCount,
      lastHeartbeat: status.lastHeartbeat,
      ownerName: status.ownerName ?? null,
      ownerAvatarUrl: status.ownerAvatarUrl ?? null,
      // Bot bản mới báo khả năng vẽ thẻ chào; null = bot chưa báo (đừng kết luận là hỏng).
      cardReady: status.cardReady ?? null,
    };
  },
});
