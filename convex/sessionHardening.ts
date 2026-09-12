/**
 * Session hardening — các mutation cũ của sessions.ts trở thành INTERNAL để
 * client không tự gọi được. `sessions:login` giờ chỉ được gọi từ action
 * `sessionAuth:exchangeAndLogin` (server-side), token do server sinh.
 */
import { internalMutation, internalQuery } from "./_generated/server";
import { v, type GenericId } from "convex/values";
import { getUserByToken, PERM_MANAGE_GUILD, guildAccessibleBy } from "./auth";

/** (internal) Đăng ký session — CHỈ action server-side được gọi. */
export const loginInternal = internalMutation({
  args: {
    token: v.string(),
    user: v.object({
      discordId: v.string(),
      username: v.string(),
      globalName: v.optional(v.string()),
      avatar: v.optional(v.string()),
    }),
    guilds: v.array(
      v.object({
        id: v.string(),
        name: v.string(),
        icon: v.optional(v.string()),
        permissions: v.string(),
      }),
    ),
  },
  handler: async (ctx, args) => {
    const manageable = args.guilds
      .filter((g) => (BigInt(g.permissions) & BigInt(PERM_MANAGE_GUILD)) !== 0n)
      .map((g) => g.id);

    let userId: GenericId<"users">;
    const existing = await ctx.db
      .query("users")
      .withIndex("by_discordId", (q) => q.eq("discordId", args.user.discordId))
      .first();
    if (existing) {
      userId = existing._id;
      await ctx.db.patch(existing._id, {
        username: args.user.username,
        globalName: args.user.globalName,
        avatar: args.user.avatar,
        manageableGuildIds: manageable,
        lastLoginAt: Date.now(),
      });
    } else {
      userId = await ctx.db.insert("users", {
        discordId: args.user.discordId,
        username: args.user.username,
        globalName: args.user.globalName,
        avatar: args.user.avatar,
        manageableGuildIds: manageable,
        lastLoginAt: Date.now(),
      });
    }

    // Register the user as a manager on every guild they can manage.
    for (const guildId of manageable) {
      const guild = await ctx.db
        .query("guilds")
        .withIndex("by_discordId", (q) => q.eq("discordId", guildId))
        .first();
      if (guild && !guild.managers.includes(args.user.discordId)) {
        await ctx.db.patch(guild._id, {
          managers: [...guild.managers, args.user.discordId],
        });
      }
    }

    const stale = await ctx.db
      .query("sessions")
      .withIndex("by_token", (q) => q.eq("token", args.token))
      .first();
    if (stale) await ctx.db.delete(stale._id);
    await ctx.db.insert("sessions", {
      token: args.token,
      userId,
      createdAt: Date.now(),
    });
    return { ok: true };
  },
});

/** (internal) Tạo phiên mới cho user đã tồn tại (silent refresh) — server-side only. */
export const newSessionInternal = internalMutation({
  args: { discordId: v.string() },
  handler: async (ctx, { discordId }) => {
    const user = await ctx.db
      .query("users")
      .withIndex("by_discordId", (q) => q.eq("discordId", discordId))
      .first();
    if (!user) return null;
    const tokenBytes = crypto.getRandomValues(new Uint8Array(32));
    // base64url thủ công (Buffer không có sẵn trong mọi runtime)
    const b64 = btoa(String.fromCharCode(...tokenBytes))
      .replace(/\+/g, "-")
      .replace(/\//g, "_")
      .replace(/=+$/, "");
    await ctx.db.insert("sessions", {
      token: b64,
      userId: user._id,
      createdAt: Date.now(),
    });
    return { token: b64 };
  },
});

/**
 * (internal) Cập nhật danh sách server quản lý của một user ĐÃ đăng nhập từ dữ
 * liệu Discord fetch phía server — client không được tự báo danh sách (trước
 * đây `sessions:refreshGuilds` nhận guilds từ client → kẻ xấu tự nhận quyền
 * Manage Server trên mọi guild). CHỈ sessionAuth:refreshGuildsServer gọi.
 */
export const guildsInternal = internalMutation({
  args: {
    discordId: v.string(),
    guilds: v.array(
      v.object({
        id: v.string(),
        name: v.string(),
        icon: v.optional(v.string()),
        permissions: v.string(),
      }),
    ),
  },
  handler: async (ctx, { discordId, guilds }) => {
    const user = await ctx.db
      .query("users")
      .withIndex("by_discordId", (q) => q.eq("discordId", discordId))
      .first();
    if (!user) return { ok: false };

    const manageable = guilds
      .filter((g) => (BigInt(g.permissions) & BigInt(PERM_MANAGE_GUILD)) !== 0n)
      .map((g) => g.id);
    await ctx.db.patch(user._id, { manageableGuildIds: manageable });

    // Ghi người dùng vào managers của mọi guild họ quản lý đã có trên Convex.
    for (const guildId of manageable) {
      const guild = await ctx.db
        .query("guilds")
        .withIndex("by_discordId", (q) => q.eq("discordId", guildId))
        .first();
      if (guild && !guild.managers.includes(discordId)) {
        await ctx.db.patch(guild._id, {
          managers: [...guild.managers, discordId],
        });
      }
    }
    return { ok: true };
  },
});

/** (internal) Đọc user theo token — dùng nội bộ. */
export const getUserByTokenInternal = internalQuery({
  args: { token: v.string() },
  handler: async (ctx, { token }) => {
    return await getUserByToken(ctx, token);
  },
});

export { guildAccessibleBy };
