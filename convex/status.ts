import { query, mutation } from "./_generated/server";
import { v } from "convex/values";
import { getUserByToken } from "./auth";

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
  },
  handler: async (ctx, { online, guildCount, memberCount, version }) => {
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

export const botStatus = query({
  args: {},
  handler: async (ctx) => {
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
    };
  },
});
