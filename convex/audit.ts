import { mutation, query } from "./_generated/server";
import { v } from "convex/values";
import { getUserByToken, canManageGuild } from "./auth";

/** Web records an audit log entry when admin changes settings. */
export const record = mutation({
  args: {
    token: v.string(),
    guildId: v.string(),
    action: v.string(),
    field: v.string(),
    oldValue: v.optional(v.string()),
    newValue: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const user = await getUserByToken(ctx, args.token);
    if (!user) throw new Error("Chưa đăng nhập");
    const guild = await ctx.db
      .query("guilds")
      .withIndex("by_discordId", (q) => q.eq("discordId", args.guildId))
      .first();
    if (!guild || !canManageGuild(user, guild)) throw new Error("Không có quyền");
    await ctx.db.insert("auditLog", {
      guildId: args.guildId,
      executorId: user.discordId,
      executorName: user.globalName ?? user.username,
      action: args.action.slice(0, 50),
      field: args.field.slice(0, 50),
      oldValue: args.oldValue?.slice(0, 500),
      newValue: args.newValue?.slice(0, 500),
      createdAt: Date.now(),
    });
    // Keep max 200 entries per guild
    const all = await ctx.db
      .query("auditLog")
      .withIndex("by_guildId_createdAt", (q) => q.eq("guildId", args.guildId))
      .order("desc")
      .collect();
    if (all.length > 200) {
      const drop = all.slice(200).map((r) => r._id);
      for (const id of drop) await ctx.db.delete(id);
    }
    return { ok: true };
  },
});

/** Get audit log entries for a guild. */
export const getLog = query({
  args: { token: v.string(), guildId: v.string(), limit: v.optional(v.number()) },
  handler: async (ctx, args) => {
    const user = await getUserByToken(ctx, args.token);
    if (!user) return [];
    const guild = await ctx.db
      .query("guilds")
      .withIndex("by_discordId", (q) => q.eq("discordId", args.guildId))
      .first();
    if (!guild || !canManageGuild(user, guild)) return [];
    const limit = Math.min(args.limit ?? 50, 100);
    const entries = await ctx.db
      .query("auditLog")
      .withIndex("by_guildId_createdAt", (q) => q.eq("guildId", args.guildId))
      .order("desc")
      .take(limit);
    return entries.map((e) => ({
      _id: e._id,
      executorId: e.executorId,
      executorName: e.executorName,
      action: e.action,
      field: e.field,
      oldValue: e.oldValue,
      newValue: e.newValue,
      createdAt: e.createdAt,
    }));
  },
});

/** Analytics: get guild stats for the last N days. */
export const getGuildAnalytics = query({
  args: { token: v.string(), guildId: v.string() },
  handler: async (ctx, args) => {
    const user = await getUserByToken(ctx, args.token);
    if (!user) return null;
    const guild = await ctx.db
      .query("guilds")
      .withIndex("by_discordId", (q) => q.eq("discordId", args.guildId))
      .first();
    if (!guild || !canManageGuild(user, guild)) return null;

    const now = Date.now();
    const dayMs = 86_400_000;
    const sevenDaysAgo = now - 7 * dayMs;

    // Antinuke events by day (last 7 days)
    const events = await ctx.db
      .query("antinukeEvents")
      .withIndex("by_guildId_createdAt", (q) => q.eq("guildId", args.guildId))
      .collect();
    const recentEvents = events.filter((e) => e.createdAt > sevenDaysAgo);
    const eventsByDay: Record<string, number> = {};
    const eventsByModule: Record<string, number> = {};
    for (const e of recentEvents) {
      const day = new Date(e.createdAt).toISOString().split("T")[0];
      eventsByDay[day] = (eventsByDay[day] ?? 0) + 1;
      eventsByModule[e.module] = (eventsByModule[e.module] ?? 0) + 1;
    }

    // Mod actions by day (last 7 days)
    const modActions = await ctx.db
      .query("modActions")
      .withIndex("by_guildId_createdAt", (q) => q.eq("guildId", args.guildId))
      .collect();
    const recentModActions = modActions.filter((a) => a.createdAt > sevenDaysAgo);
    const modByDay: Record<string, number> = {};
    const modByType: Record<string, number> = {};
    for (const a of recentModActions) {
      const day = new Date(a.createdAt).toISOString().split("T")[0];
      modByDay[day] = (modByDay[day] ?? 0) + 1;
      modByType[a.action] = (modByType[a.action] ?? 0) + 1;
    }

    // Heat stats
    const heatStates = await ctx.db
      .query("heatStates")
      .withIndex("by_guildId", (q) => q.eq("guildId", args.guildId))
      .collect();
    const topHeat = heatStates
      .sort((a, b) => b.heat - a.heat)
      .slice(0, 10)
      .map((h) => ({ userId: h.userId, username: h.username, heat: h.heat }));

    return {
      memberCount: guild.memberCount ?? 0,
      antinukeEvents7d: recentEvents.length,
      modActions7d: recentModActions.length,
      eventsByDay,
      eventsByModule,
      modByDay,
      modByType,
      topHeat,
    };
  },
});

/** Analytics: get backup stats for a guild. */
export const getBackupAnalytics = query({
  args: { token: v.string(), guildId: v.string() },
  handler: async (ctx, args) => {
    const user = await getUserByToken(ctx, args.token);
    if (!user) return null;
    const guild = await ctx.db
      .query("guilds")
      .withIndex("by_discordId", (q) => q.eq("discordId", args.guildId))
      .first();
    if (!guild || !canManageGuild(user, guild)) return null;

    const backups = await ctx.db
      .query("guildBackups")
      .withIndex("by_guildId", (q) => q.eq("guildId", args.guildId))
      .collect();
    const sorted = backups.sort((a, b) => b.createdAt - a.createdAt);

    return {
      total: sorted.length,
      lastBackupAt: guild.lastBackupAt ?? null,
      autoDays: guild.backupAutoDays ?? 0,
      backups: sorted.map((b) => ({
        _id: b._id,
        createdAt: b.createdAt,
        roleCount: b.roleCount,
        channelCount: b.channelCount,
        emojiCount: b.emojiCount ?? 0,
        messageCount: b.messageCount ?? 0,
        source: b.source ?? "backup",
        checksum: b.backupChecksum ?? null,
        compressed: b.backupCompressed ?? false,
        encrypted: b.backupEncrypted ?? false,
      })),
    };
  },
});
