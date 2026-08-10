import { mutation, query } from "./_generated/server";
import { v } from "convex/values";
import { getUserByToken, canManageGuild } from "./auth";
import {
  ANTI_NUKE_MODULES,
  HEAT_DEFAULTS,
  MODULE_HEAT_DEFAULTS,
  WARN_STRIKE_DEFAULTS,
} from "./modules";

/** Decay a stored heat value by the guild's per-minute decay rate. */
function decayHeat(heat: number, updatedAt: number, decayPerMin: number) {
  const elapsedMin = (Date.now() - updatedAt) / 60000;
  return Math.max(0, Math.round(heat - elapsedMin * decayPerMin));
}

async function loadHeatStates(ctx: { db: import("./_generated/server").DatabaseReader }, guildId: string, decayPerMin: number) {
  const raw = await ctx.db
    .query("heatStates")
    .withIndex("by_guildId_heat", (q) => q.eq("guildId", guildId))
    .order("desc")
    .take(15);
  return raw
    .map((h) => ({
      userId: h.userId,
      username: h.username,
      heat: decayHeat(h.heat, h.updatedAt, decayPerMin),
      updatedAt: h.updatedAt,
      warnStrikes: h.warnStrikes ?? 0,
    }))
    .filter((h) => h.heat > 0 || h.warnStrikes > 0);
}

export const listMine = query({
  args: { token: v.string() },
  handler: async (ctx, { token }) => {
    const user = await getUserByToken(ctx, token);
    if (!user) return null;
    const all = await ctx.db.query("guilds").collect();
    return all
      .filter((g) => g.managers.includes(user.discordId))
      .map((g) => ({
        discordId: g.discordId,
        name: g.name,
        icon: g.icon ?? null,
        memberCount: g.memberCount ?? null,
        prefix: g.prefix,
        antinukeEnabled: g.antinukeEnabled,
        botInGuild: g.botInGuild,
        lastHeartbeat: g.lastHeartbeat ?? null,
      }));
  },
});

export const getGuild = query({
  args: { token: v.string(), guildId: v.string() },
  handler: async (ctx, { token, guildId }) => {
    const user = await getUserByToken(ctx, token);
    if (!user) return null;
    const guild = await ctx.db
      .query("guilds")
      .withIndex("by_discordId", (q) => q.eq("discordId", guildId))
      .first();
    if (!guild || !canManageGuild(user, guild)) return null;
    const autoReplies = await ctx.db
      .query("autoReplies")
      .withIndex("by_guildId", (q) => q.eq("guildId", guildId))
      .collect();
    const modules = await ctx.db
      .query("antinukeModules")
      .withIndex("by_guildId", (q) => q.eq("guildId", guildId))
      .collect();
    const channels = await ctx.db
      .query("guildChannels")
      .withIndex("by_guildId", (q) => q.eq("guildId", guildId))
      .collect();
    const roles = await ctx.db
      .query("guildRoles")
      .withIndex("by_guildId", (q) => q.eq("guildId", guildId))
      .collect();
    const decayPerMin = guild.heatDecayPerMin ?? HEAT_DEFAULTS.decayPerMin;
    const heatStates = await loadHeatStates(ctx, guildId, decayPerMin);
    const safetyPercent = Math.max(0, Math.min(100, 100 - (heatStates[0]?.heat ?? 0)));
    return {
      guild: {
        discordId: guild.discordId,
        name: guild.name,
        icon: guild.icon ?? null,
        memberCount: guild.memberCount ?? null,
        prefix: guild.prefix,
        logChannelId: guild.logChannelId ?? null,
        modRoles: guild.modRoles,
        adminRoles: guild.adminRoles,
        antinukeEnabled: guild.antinukeEnabled,
        botInGuild: guild.botInGuild,
        lastHeartbeat: guild.lastHeartbeat ?? null,
        lockdownEnabled: guild.lockdownEnabled ?? true,
        lockdownMinutes: guild.lockdownMinutes ?? 5,
        lockdownUntil: guild.lockdownUntil ?? null,
        lockdownRequested: guild.lockdownRequested ?? false,
        dailyReportEnabled: guild.dailyReportEnabled ?? true,
        lastReportAt: guild.lastReportAt ?? null,
        badWords: guild.badWords ?? [],
        heatEnabled: guild.heatEnabled ?? HEAT_DEFAULTS.enabled,
        heatDecayPerMin: decayPerMin,
        heatWarnAt: guild.heatWarnAt ?? HEAT_DEFAULTS.warnAt,
        heatTimeoutAt: guild.heatTimeoutAt ?? HEAT_DEFAULTS.timeoutAt,
        heatKickAt: guild.heatKickAt ?? HEAT_DEFAULTS.kickAt,
        heatBanAt: guild.heatBanAt ?? HEAT_DEFAULTS.banAt,
        joinGateEnabled: guild.joinGateEnabled ?? false,
        joinGateMinAgeDays: guild.joinGateMinAgeDays ?? 0,
        joinGateRequireAvatar: guild.joinGateRequireAvatar ?? false,
        joinGateRequireFlag: guild.joinGateRequireFlag ?? false,
        joinGateRaidKick: guild.joinGateRaidKick ?? false,
        joinGatePunish: guild.joinGatePunish ?? "kick",
        joinGateWhitelist: guild.joinGateWhitelist ?? [],
        heatRepeatMultiplier: guild.heatRepeatMultiplier ?? HEAT_DEFAULTS.repeatMultiplier,
        heatRepeatWindowMin: guild.heatRepeatWindowMin ?? HEAT_DEFAULTS.repeatWindowMin,
        warnStrikeLimit: guild.warnStrikeLimit ?? WARN_STRIKE_DEFAULTS.limit,
        warnStrikeWindowMin: guild.warnStrikeWindowMin ?? WARN_STRIKE_DEFAULTS.windowMin,
        warnStrikePunish: guild.warnStrikePunish ?? WARN_STRIKE_DEFAULTS.punish,
        safetyPercent,
      },
      heatStates,
      autoReplies: autoReplies.map((r) => ({
        _id: r._id,
        name: r.name,
        triggerType: r.triggerType,
        keywords: r.keywords,
        response: r.response,
        channels: r.channels,
        cooldownSeconds: r.cooldownSeconds,
        enabled: r.enabled,
        createdAt: r.createdAt,
      })),
      modules: modules.map((m) => ({
        module: m.module,
        enabled: m.enabled,
        threshold: m.threshold,
        windowSeconds: m.windowSeconds,
        punish: m.punish,
        whitelistRoles: m.whitelistRoles,
        heat: m.heat ?? MODULE_HEAT_DEFAULTS[m.module] ?? 10,
      })),
      channels: channels.map((c) => ({
        channelId: c.channelId,
        name: c.name,
        type: c.type,
      })),
      roles: roles.map((r) => ({
        roleId: r.roleId,
        name: r.name,
        color: r.color,
        position: r.position,
      })),
    };
  },
});

/** Lightweight config bundle that the Discord bot fetches per guild. */
export const getBotConfig = query({
  args: { guildId: v.string() },
  handler: async (ctx, { guildId }) => {
    const guild = await ctx.db
      .query("guilds")
      .withIndex("by_discordId", (q) => q.eq("discordId", guildId))
      .first();
    if (!guild) return null;
    const autoReplies = (
      await ctx.db
        .query("autoReplies")
        .withIndex("by_guildId", (q) => q.eq("guildId", guildId))
        .collect()
    ).filter((a) => a.enabled);
    const modules = await ctx.db
      .query("antinukeModules")
      .withIndex("by_guildId", (q) => q.eq("guildId", guildId))
      .collect();
    const decayPerMin = guild.heatDecayPerMin ?? HEAT_DEFAULTS.decayPerMin;
    const heatStates = await loadHeatStates(ctx, guildId, decayPerMin);
    const safetyPercent = Math.max(0, Math.min(100, 100 - (heatStates[0]?.heat ?? 0)));
    return {
      prefix: guild.prefix,
      logChannelId: guild.logChannelId ?? null,
      modRoles: guild.modRoles,
      adminRoles: guild.adminRoles,
      antinukeEnabled: guild.antinukeEnabled,
      lockdownEnabled: guild.lockdownEnabled ?? true,
      lockdownMinutes: guild.lockdownMinutes ?? 5,
      lockdownUntil: guild.lockdownUntil ?? null,
      lockdownRequested: guild.lockdownRequested ?? false,
      dailyReportEnabled: guild.dailyReportEnabled ?? true,
      lastReportAt: guild.lastReportAt ?? null,
      badWords: guild.badWords ?? [],
      heatEnabled: guild.heatEnabled ?? HEAT_DEFAULTS.enabled,
      heatDecayPerMin: decayPerMin,
      heatWarnAt: guild.heatWarnAt ?? HEAT_DEFAULTS.warnAt,
      heatTimeoutAt: guild.heatTimeoutAt ?? HEAT_DEFAULTS.timeoutAt,
      heatKickAt: guild.heatKickAt ?? HEAT_DEFAULTS.kickAt,
      heatBanAt: guild.heatBanAt ?? HEAT_DEFAULTS.banAt,
      safetyPercent,
      heatResetRequested: guild.heatResetRequested ?? false,
      heatResetUserId: guild.heatResetUserId ?? null,
      joinGateEnabled: guild.joinGateEnabled ?? false,
      joinGateMinAgeDays: guild.joinGateMinAgeDays ?? 0,
      joinGateRequireAvatar: guild.joinGateRequireAvatar ?? false,
      joinGateRequireFlag: guild.joinGateRequireFlag ?? false,
      joinGateRaidKick: guild.joinGateRaidKick ?? false,
      joinGatePunish: guild.joinGatePunish ?? "kick",
      joinGateWhitelist: guild.joinGateWhitelist ?? [],
      heatRepeatMultiplier: guild.heatRepeatMultiplier ?? HEAT_DEFAULTS.repeatMultiplier,
      heatRepeatWindowMin: guild.heatRepeatWindowMin ?? HEAT_DEFAULTS.repeatWindowMin,
      warnStrikeLimit: guild.warnStrikeLimit ?? WARN_STRIKE_DEFAULTS.limit,
      warnStrikeWindowMin: guild.warnStrikeWindowMin ?? WARN_STRIKE_DEFAULTS.windowMin,
      warnStrikePunish: guild.warnStrikePunish ?? WARN_STRIKE_DEFAULTS.punish,
      heatStates,
      autoReplies,
      modules: modules.map((m) => ({
        module: m.module,
        enabled: m.enabled,
        threshold: m.threshold,
        windowSeconds: m.windowSeconds,
        punish: m.punish,
        whitelistRoles: m.whitelistRoles,
        heat: m.heat ?? MODULE_HEAT_DEFAULTS[m.module] ?? 10,
      })),
    };
  },
});

export const updateSettings = mutation({
  args: {
    token: v.string(),
    guildId: v.string(),
    prefix: v.optional(v.string()),
    logChannelId: v.optional(v.string()),
    modRoles: v.optional(v.array(v.string())),
    adminRoles: v.optional(v.array(v.string())),
    dailyReportEnabled: v.optional(v.boolean()),
    badWords: v.optional(v.array(v.string())),
    heatEnabled: v.optional(v.boolean()),
    heatDecayPerMin: v.optional(v.number()),
    heatWarnAt: v.optional(v.number()),
    heatTimeoutAt: v.optional(v.number()),
    heatKickAt: v.optional(v.number()),
    heatBanAt: v.optional(v.number()),
    joinGateEnabled: v.optional(v.boolean()),
    joinGateMinAgeDays: v.optional(v.number()),
    joinGateRequireAvatar: v.optional(v.boolean()),
    joinGateRequireFlag: v.optional(v.boolean()),
    joinGateRaidKick: v.optional(v.boolean()),
    joinGatePunish: v.optional(v.union(v.literal("kick"), v.literal("ban"))),
    joinGateWhitelist: v.optional(v.array(v.string())),
    heatRepeatMultiplier: v.optional(v.number()),
    heatRepeatWindowMin: v.optional(v.number()),
    warnStrikeLimit: v.optional(v.number()),
    warnStrikeWindowMin: v.optional(v.number()),
    warnStrikePunish: v.optional(
      v.union(v.literal("timeout"), v.literal("kick"), v.literal("ban")),
    ),
  },
  handler: async (ctx, args) => {
    const user = await getUserByToken(ctx, args.token);
    const guild = await ctx.db
      .query("guilds")
      .withIndex("by_discordId", (q) => q.eq("discordId", args.guildId))
      .first();
    if (!guild || !canManageGuild(user, guild)) throw new Error("Không có quyền quản lý server này");
    const patch: Record<string, unknown> = { updatedAt: Date.now() };
    if (args.dailyReportEnabled !== undefined) patch.dailyReportEnabled = args.dailyReportEnabled;
    if (args.prefix !== undefined) {
      if (!/^[!^$#&%]{1,3}$/.test(args.prefix)) {
        throw new Error("Prefix phải là 1-3 ký tự đặc biệt (ví dụ: !, ^, !! )");
      }
      patch.prefix = args.prefix;
    }
    if (args.logChannelId !== undefined) patch.logChannelId = args.logChannelId || undefined;
    if (args.modRoles !== undefined) patch.modRoles = args.modRoles;
    if (args.adminRoles !== undefined) patch.adminRoles = args.adminRoles;
    if (args.badWords !== undefined) {
      if (args.badWords.length > 100) throw new Error("Tối đa 100 từ ngữ xấu");
      const words = args.badWords
        .map((w) => w.trim().toLowerCase())
        .filter((w) => w.length > 0 && w.length <= 40);
      patch.badWords = [...new Set(words)];
    }
    if (args.heatEnabled !== undefined) patch.heatEnabled = args.heatEnabled;
    if (args.heatDecayPerMin !== undefined) {
      patch.heatDecayPerMin = Math.max(0, Math.min(60, Math.floor(args.heatDecayPerMin)));
    }
    if (args.heatWarnAt !== undefined) {
      const w = Math.max(1, Math.min(99, Math.floor(args.heatWarnAt)));
      const t = args.heatTimeoutAt ?? guild.heatTimeoutAt ?? HEAT_DEFAULTS.timeoutAt;
      if (w >= t) throw new Error("Ngưỡng cảnh báo phải nhỏ hơn ngưỡng tạm khóa");
      patch.heatWarnAt = w;
    }
    if (
      args.heatTimeoutAt !== undefined ||
      args.heatKickAt !== undefined ||
      args.heatBanAt !== undefined
    ) {
      const t = args.heatTimeoutAt ?? guild.heatTimeoutAt ?? HEAT_DEFAULTS.timeoutAt;
      const k = args.heatKickAt ?? guild.heatKickAt ?? HEAT_DEFAULTS.kickAt;
      const b = args.heatBanAt ?? guild.heatBanAt ?? HEAT_DEFAULTS.banAt;
      const tC = Math.max(1, Math.min(100, t));
      const kC = Math.max(1, Math.min(100, k));
      const bC = Math.max(1, Math.min(100, b));
      if (!(tC < kC && kC < bC)) {
        throw new Error("Ngưỡng nhiệt phải tăng dần: tạm khóa < kick < ban");
      }
      patch.heatTimeoutAt = tC;
      patch.heatKickAt = kC;
      patch.heatBanAt = bC;
    }
    if (args.joinGateEnabled !== undefined) patch.joinGateEnabled = args.joinGateEnabled;
    if (args.joinGateMinAgeDays !== undefined) {
      patch.joinGateMinAgeDays = Math.max(0, Math.min(3650, Math.floor(args.joinGateMinAgeDays)));
    }
    if (args.joinGateRequireAvatar !== undefined) patch.joinGateRequireAvatar = args.joinGateRequireAvatar;
    if (args.joinGateRequireFlag !== undefined) patch.joinGateRequireFlag = args.joinGateRequireFlag;
    if (args.joinGateRaidKick !== undefined) patch.joinGateRaidKick = args.joinGateRaidKick;
    if (args.joinGatePunish !== undefined) patch.joinGatePunish = args.joinGatePunish;
    if (args.joinGateWhitelist !== undefined) {
      const ids = args.joinGateWhitelist
        .map((id) => id.trim())
        .filter((id) => /^\d{15,20}$/.test(id))
        .slice(0, 100);
      patch.joinGateWhitelist = [...new Set(ids)];
    }
    if (args.heatRepeatMultiplier !== undefined) {
      patch.heatRepeatMultiplier = Math.max(1, Math.min(10, Math.floor(args.heatRepeatMultiplier)));
    }
    if (args.heatRepeatWindowMin !== undefined) {
      patch.heatRepeatWindowMin = Math.max(1, Math.min(1440, Math.floor(args.heatRepeatWindowMin)));
    }
    if (args.warnStrikeLimit !== undefined) {
      patch.warnStrikeLimit = Math.max(0, Math.min(20, Math.floor(args.warnStrikeLimit)));
    }
    if (args.warnStrikeWindowMin !== undefined) {
      patch.warnStrikeWindowMin = Math.max(1, Math.min(1440, Math.floor(args.warnStrikeWindowMin)));
    }
    if (args.warnStrikePunish !== undefined) patch.warnStrikePunish = args.warnStrikePunish;
    await ctx.db.patch(guild._id, patch);
    return { ok: true };
  },
});

export const updateLockdown = mutation({
  args: {
    token: v.string(),
    guildId: v.string(),
    enabled: v.optional(v.boolean()),
    minutes: v.optional(v.number()),
  },
  handler: async (ctx, { token, guildId, enabled, minutes }) => {
    const user = await getUserByToken(ctx, token);
    const guild = await ctx.db
      .query("guilds")
      .withIndex("by_discordId", (q) => q.eq("discordId", guildId))
      .first();
    if (!guild || !canManageGuild(user, guild)) throw new Error("Không có quyền quản lý server này");
    const patch: Record<string, unknown> = { updatedAt: Date.now() };
    if (enabled !== undefined) patch.lockdownEnabled = enabled;
    if (minutes !== undefined) {
      patch.lockdownMinutes = Math.max(1, Math.min(120, Math.floor(minutes)));
    }
    await ctx.db.patch(guild._id, patch);
    return { ok: true };
  },
});

/** Dashboard xóa nhiệt độ của một (hoặc toàn bộ) thành viên. */
export const resetHeat = mutation({
  args: { token: v.string(), guildId: v.string(), userId: v.optional(v.string()) },
  handler: async (ctx, { token, guildId, userId }) => {
    const user = await getUserByToken(ctx, token);
    const guild = await ctx.db
      .query("guilds")
      .withIndex("by_discordId", (q) => q.eq("discordId", guildId))
      .first();
    if (!guild || !canManageGuild(user, guild)) {
      throw new Error("Không có quyền quản lý server này");
    }
    const states = await ctx.db
      .query("heatStates")
      .withIndex("by_guildId", (q) => q.eq("guildId", guildId))
      .collect();
    for (const s of states) {
      if (userId && s.userId !== userId) continue;
      await ctx.db.delete(s._id);
    }
    // Báo bot xóa nhiệt trong bộ nhớ (bot kiểm tra cờ này định kỳ).
    await ctx.db.patch(guild._id, {
      heatResetRequested: true,
      heatResetUserId: userId ?? undefined,
      updatedAt: Date.now(),
    });
    return { ok: true };
  },
});

/** Dashboard asks the bot to unlock the guild immediately. */
export const requestUnlock = mutation({
  args: { token: v.string(), guildId: v.string() },
  handler: async (ctx, { token, guildId }) => {
    const user = await getUserByToken(ctx, token);
    const guild = await ctx.db
      .query("guilds")
      .withIndex("by_discordId", (q) => q.eq("discordId", guildId))
      .first();
    if (!guild || !canManageGuild(user, guild)) throw new Error("Không có quyền quản lý server này");
    await ctx.db.patch(guild._id, {
      lockdownRequested: true,
      updatedAt: Date.now(),
    });
    return { ok: true };
  },
});

export const setAntinukeGlobal = mutation({
  args: { token: v.string(), guildId: v.string(), enabled: v.boolean() },
  handler: async (ctx, { token, guildId, enabled }) => {
    const user = await getUserByToken(ctx, token);
    const guild = await ctx.db
      .query("guilds")
      .withIndex("by_discordId", (q) => q.eq("discordId", guildId))
      .first();
    if (!guild || !canManageGuild(user, guild)) throw new Error("Không có quyền quản lý server này");
    await ctx.db.patch(guild._id, { antinukeEnabled: enabled, updatedAt: Date.now() });
    return { ok: true };
  },
});

/* ------------------------- Bot-side sync ------------------------- */

export const botSyncGuilds = mutation({
  args: {
    guilds: v.array(
      v.object({
        id: v.string(),
        name: v.string(),
        icon: v.optional(v.string()),
        memberCount: v.optional(v.number()),
      }),
    ),
  },
  handler: async (ctx, { guilds }) => {
    const now = Date.now();
    const present = new Set(guilds.map((g) => g.id));
    for (const g of guilds) {
      const existing = await ctx.db
        .query("guilds")
        .withIndex("by_discordId", (q) => q.eq("discordId", g.id))
        .first();
      if (existing) {
        await ctx.db.patch(existing._id, {
          name: g.name,
          icon: g.icon,
          memberCount: g.memberCount,
          botInGuild: true,
          lastHeartbeat: now,
          updatedAt: now,
        });
      } else {
        const id = await ctx.db.insert("guilds", {
          discordId: g.id,
          name: g.name,
          icon: g.icon,
          memberCount: g.memberCount,
          prefix: "!",
          logChannelId: undefined,
          modRoles: [],
          adminRoles: [],
          antinukeEnabled: true,
          lockdownEnabled: true,
          lockdownMinutes: 5,
          lockdownUntil: undefined,
          lockdownRequested: false,
          dailyReportEnabled: true,
          lastReportAt: undefined,
          badWords: [],
          heatEnabled: HEAT_DEFAULTS.enabled,
          heatDecayPerMin: HEAT_DEFAULTS.decayPerMin,
          heatWarnAt: HEAT_DEFAULTS.warnAt,
          heatTimeoutAt: HEAT_DEFAULTS.timeoutAt,
          heatKickAt: HEAT_DEFAULTS.kickAt,
          heatBanAt: HEAT_DEFAULTS.banAt,
          joinGateEnabled: false,
          joinGateMinAgeDays: 0,
          joinGateRequireAvatar: false,
          joinGateRequireFlag: false,
          joinGateRaidKick: false,
          joinGatePunish: "kick" as const,
          joinGateWhitelist: [],
          heatRepeatMultiplier: HEAT_DEFAULTS.repeatMultiplier,
          heatRepeatWindowMin: HEAT_DEFAULTS.repeatWindowMin,
          warnStrikeLimit: WARN_STRIKE_DEFAULTS.limit,
          warnStrikeWindowMin: WARN_STRIKE_DEFAULTS.windowMin,
          warnStrikePunish: WARN_STRIKE_DEFAULTS.punish as "timeout" | "kick" | "ban",
          managers: [],
          botInGuild: true,
          lastHeartbeat: now,
          createdAt: now,
          updatedAt: now,
        });
        for (const m of ANTI_NUKE_MODULES) {
          await ctx.db.insert("antinukeModules", {
            guildId: g.id,
            module: m.module,
            enabled: true,
            threshold: m.threshold,
            windowSeconds: m.windowSeconds,
            punish: m.punish as "warn" | "kick" | "ban" | "timeout",
            whitelistRoles: [],
            timeoutSeconds:
              m.module === "spam" || m.module === "attachment" ? 300 : 600,
            heat: m.heat,
            updatedAt: now,
          });
        }
        void id;
      }
    }
    // Guilds the bot left are no longer synced.
    const all = await ctx.db.query("guilds").collect();
    for (const guild of all) {
      if (guild.botInGuild && !present.has(guild.discordId)) {
        await ctx.db.patch(guild._id, { botInGuild: false, updatedAt: now });
      }
    }
    return { ok: true };
  },
});

export const botHeartbeat = mutation({
  args: {
    guildCount: v.number(),
    memberCount: v.number(),
    version: v.string(),
  },
  handler: async (ctx, args) => {
    const now = Date.now();
    const existing = await ctx.db
      .query("botStatus")
      .withIndex("by_kind", (q) => q.eq("kind", "status"))
      .first();
    if (existing) {
      await ctx.db.patch(existing._id, {
        online: true,
        guildCount: args.guildCount,
        memberCount: args.memberCount,
        lastHeartbeat: now,
        version: args.version,
      });
    } else {
      await ctx.db.insert("botStatus", {
        kind: "status",
        online: true,
        guildCount: args.guildCount,
        memberCount: args.memberCount,
        lastHeartbeat: now,
        startedAt: now,
        version: args.version,
      });
    }
    return { ok: true };
  },
});

export const syncChannels = mutation({
  args: {
    guildId: v.string(),
    channels: v.array(
      v.object({ channelId: v.string(), name: v.string(), type: v.number() }),
    ),
  },
  handler: async (ctx, { guildId, channels }) => {
    const old = await ctx.db
      .query("guildChannels")
      .withIndex("by_guildId", (q) => q.eq("guildId", guildId))
      .collect();
    for (const c of old) await ctx.db.delete(c._id);
    for (const c of channels) {
      await ctx.db.insert("guildChannels", {
        guildId,
        channelId: c.channelId,
        name: c.name,
        type: c.type,
      });
    }
    return { ok: true };
  },
});

export const syncRoles = mutation({
  args: {
    guildId: v.string(),
    roles: v.array(
      v.object({ roleId: v.string(), name: v.string(), color: v.number(), position: v.number() }),
    ),
  },
  handler: async (ctx, { guildId, roles }) => {
    const old = await ctx.db
      .query("guildRoles")
      .withIndex("by_guildId", (q) => q.eq("guildId", guildId))
      .collect();
    for (const r of old) await ctx.db.delete(r._id);
    for (const r of roles) {
      await ctx.db.insert("guildRoles", {
        guildId,
        roleId: r.roleId,
        name: r.name,
        color: r.color,
        position: r.position,
      });
    }
    return { ok: true };
  },
});
