import { query } from "./_generated/server";
import { paginationOptsValidator } from "convex/server";
import { v } from "convex/values";
import { getUserByToken, canManageGuild } from "./auth";

const EVENT_FIELDS = (e: {
  module: string;
  executorId?: string;
  executorName?: string;
  action: string;
  count: number;
  threshold: number;
  windowSeconds: number;
  punish: string;
  createdAt: number;
}) => ({
  module: e.module,
  executorId: e.executorId ?? null,
  executorName: e.executorName ?? null,
  action: e.action,
  count: e.count,
  threshold: e.threshold,
  windowSeconds: e.windowSeconds,
  punish: e.punish,
  createdAt: e.createdAt,
});

/** Recent anti-nuke events for the dashboard (manager-gated). */
export const recentForGuild = query({
  args: {
    token: v.string(),
    guildId: v.string(),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, { token, guildId, limit }) => {
    const user = await getUserByToken(ctx, token);
    const guild = await ctx.db
      .query("guilds")
      .withIndex("by_discordId", (q) => q.eq("discordId", guildId))
      .first();
    if (!canManageGuild(user, guild)) return null;
    const events = await ctx.db
      .query("antinukeEvents")
      .withIndex("by_guildId_createdAt", (q) => q.eq("guildId", guildId))
      .order("desc")
      .take(Math.min(limit ?? 8, 50));
    return events.map(EVENT_FIELDS);
  },
});

/**
 * Paginated event history for the dashboard (manager-gated).
 * Filters: module, from/to timestamp range, and case-insensitive search on the
 * culprit's Discord name.
 */
export const historyForGuild = query({
  args: {
    token: v.string(),
    guildId: v.string(),
    module: v.optional(v.string()),
    from: v.optional(v.number()),
    to: v.optional(v.number()),
    search: v.optional(v.string()),
    paginationOpts: paginationOptsValidator,
  },
  handler: async (ctx, { token, guildId, module, from, to, search, paginationOpts }) => {
    const user = await getUserByToken(ctx, token);
    const guild = await ctx.db
      .query("guilds")
      .withIndex("by_discordId", (q) => q.eq("discordId", guildId))
      .first();
    if (!canManageGuild(user, guild)) {
      return { page: [], isDone: true, continueCursor: "" };
    }
    let q = ctx.db
      .query("antinukeEvents")
      .withIndex("by_guildId_createdAt", (qq) => qq.eq("guildId", guildId))
      .order("desc");
    if (module) q = q.filter((qq) => qq.eq(qq.field("module"), module));
    if (from !== undefined) q = q.filter((qq) => qq.gte(qq.field("createdAt"), from));
    if (to !== undefined) q = q.filter((qq) => qq.lte(qq.field("createdAt"), to));
    const term = search?.trim().toLowerCase();
    if (term) {
      // Case-insensitive prefix match on the culprit's name: [term, term + maxChar)
      const termUpper = term + "\uffff";
      q = q.filter((qq) =>
        qq.and(
          qq.gte(qq.field("executorNameLower"), term),
          qq.lt(qq.field("executorNameLower"), termUpper),
        ),
      );
    }
    const page = await q.paginate(paginationOpts);
    return { ...page, page: page.page.map(EVENT_FIELDS) };
  },
});

/** Danh sách guild đang có bot (dùng cho script chẩn đoán lặp từng guild). */
export const botListGuildIds = query({
  args: {},
  handler: async (ctx) => {
    const guilds = await ctx.db.query("guilds").collect();
    return guilds
      .filter((g) => g.botInGuild)
      .map((g) => ({ guildId: g.discordId, name: g.name }));
  },
});

/** Sự kiện chống nuke của MỘT guild từ mốc `since` (dùng cho báo cáo hằng ngày).
 * Per-guild thay vì query global: chỉ chạy khi guild thực sự đến hạn báo cáo
 * (tiết kiệm hàng triệu reads/tháng khi nhiều guild). */
export const getGuildEvents = query({
  args: { guildId: v.string(), since: v.number(), limit: v.optional(v.number()) },
  handler: async (ctx, { guildId, since, limit }) => {
    const events = await ctx.db
      .query("antinukeEvents")
      .withIndex("by_guildId_createdAt", (q) => q.eq("guildId", guildId).gte("createdAt", since))
      .order("desc")
      .take(Math.min(limit ?? 500, 500));
    return events.map(EVENT_FIELDS);
  },
});
