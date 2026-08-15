import { mutation } from "./_generated/server";
import { v } from "convex/values";
import { ANTI_NUKE_MODULES, isAntiNukeModule } from "./modules";

const ALLOWED_ACTIONS = [
  "warn",
  "kick",
  "ban",
  "timeout",
  "deleteMessages",
  "purgeMessages",
] as const;
const ACTION_STRENGTH: Record<string, number> = { warn: 1, timeout: 2, kick: 3, ban: 4 };

/** Lọc + chuẩn hóa danh sách hành động, trả về hình phạt mạnh nhất. */
function normalizeActions(raw: string[] | undefined): {
  actions: string[];
  strongest: "warn" | "kick" | "ban" | "timeout";
} {
  const actions = [...new Set((raw ?? []).filter((a) => (ALLOWED_ACTIONS as readonly string[]).includes(a)))].slice(0, 6);
  const member = actions
    .filter((a) => ACTION_STRENGTH[a] != null)
    .sort((a, b) => ACTION_STRENGTH[b] - ACTION_STRENGTH[a]);
  const strongest = (member[0] ?? "warn") as "warn" | "kick" | "ban" | "timeout";
  return { actions, strongest };
}

/**
 * These mutations are called by the Discord bot process itself. The bot
 * validates the executor's Discord permissions before calling them, and only
 * the bot holds the Convex admin/deploy key, so no session token is checked.
 */

export const botUpdateSettings = mutation({
  args: {
    guildId: v.string(),
    prefix: v.optional(v.string()),
    logChannelId: v.optional(v.union(v.string(), v.null())),
    modRoles: v.optional(v.array(v.string())),
    adminRoles: v.optional(v.array(v.string())),
    badWords: v.optional(v.array(v.string())),
  },
  handler: async (ctx, args) => {
    const guild = await ctx.db
      .query("guilds")
      .withIndex("by_discordId", (q) => q.eq("discordId", args.guildId))
      .first();
    if (!guild) throw new Error("Server chưa được đồng bộ");
    const patch: Record<string, unknown> = { updatedAt: Date.now() };
    if (args.prefix !== undefined) {
      if (!/^[!^$#&%]{1,3}$/.test(args.prefix)) {
        throw new Error("Prefix phải là 1-3 ký tự đặc biệt");
      }
      patch.prefix = args.prefix;
    }
    if (args.logChannelId !== undefined) patch.logChannelId = args.logChannelId ?? undefined;
    if (args.modRoles !== undefined) patch.modRoles = args.modRoles;
    if (args.adminRoles !== undefined) patch.adminRoles = args.adminRoles;
    if (args.badWords !== undefined) {
      const words = args.badWords
        .map((w) => w.trim().toLowerCase())
        .filter((w) => w.length > 0 && w.length <= 40)
        .slice(0, 100);
      patch.badWords = [...new Set(words)];
    }
    await ctx.db.patch(guild._id, patch);
    return { ok: true };
  },
});


export const botAutoReplyUpsert = mutation({
  args: {
    guildId: v.string(),
    name: v.string(),
    triggerType: v.union(v.literal("keyword"), v.literal("mention")),
    keywords: v.array(v.string()),
    response: v.string(),
    channels: v.array(v.string()),
    cooldownSeconds: v.number(),
    enabled: v.boolean(),
  },
  handler: async (ctx, args) => {
    if (!/^[a-z0-9_-]{1,32}$/i.test(args.name)) throw new Error("Tên rule không hợp lệ");
    const now = Date.now();
    const existing = await ctx.db
      .query("autoReplies")
      .withIndex("by_guildId_name", (q) =>
        q.eq("guildId", args.guildId).eq("name", args.name),
      )
      .first();
    if (existing) {
      await ctx.db.patch(existing._id, {
        triggerType: args.triggerType,
        keywords: args.keywords,
        response: args.response,
        channels: args.channels,
        cooldownSeconds: args.cooldownSeconds,
        enabled: args.enabled,
        updatedAt: now,
      });
    } else {
      await ctx.db.insert("autoReplies", {
        guildId: args.guildId,
        name: args.name,
        triggerType: args.triggerType,
        keywords: args.keywords,
        response: args.response,
        channels: args.channels,
        cooldownSeconds: args.cooldownSeconds,
        enabled: args.enabled,
        createdAt: now,
        updatedAt: now,
      });
    }
    return { ok: true };
  },
});


export const botAutoReplyRemove = mutation({
  args: { guildId: v.string(), name: v.string() },
  handler: async (ctx, { guildId, name }) => {
    const existing = await ctx.db
      .query("autoReplies")
      .withIndex("by_guildId_name", (q) => q.eq("guildId", guildId).eq("name", name))
      .first();
    if (existing) await ctx.db.delete(existing._id);
    return { ok: true };
  },
});


export const botModuleUpdate = mutation({
  args: {
    guildId: v.string(),
    module: v.string(),
    enabled: v.optional(v.boolean()),
    threshold: v.optional(v.number()),
    windowSeconds: v.optional(v.number()),
    punish: v.optional(
      v.union(v.literal("warn"), v.literal("kick"), v.literal("ban"), v.literal("timeout")),
    ),
    actions: v.optional(v.array(v.string())),
    timeoutSeconds: v.optional(v.number()),
    whitelistRoles: v.optional(v.array(v.string())),
    heat: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    if (!isAntiNukeModule(args.module)) throw new Error("Module không hợp lệ");
    const mod = await ctx.db
      .query("antinukeModules")
      .withIndex("by_guild_module", (q) =>
        q.eq("guildId", args.guildId).eq("module", args.module),
      )
      .first();
    const patch: Record<string, unknown> = { updatedAt: Date.now() };
    if (args.enabled !== undefined) patch.enabled = args.enabled;
    if (args.threshold !== undefined) patch.threshold = Math.max(1, args.threshold);
    if (args.windowSeconds !== undefined) patch.windowSeconds = Math.max(1, args.windowSeconds);
    if (args.actions !== undefined) {
      const { actions, strongest } = normalizeActions(args.actions);
      patch.actions = actions;
      patch.punish = strongest;
    } else if (args.punish !== undefined) {
      patch.punish = args.punish;
      patch.actions = [args.punish];
    }
    if (args.timeoutSeconds !== undefined) patch.timeoutSeconds = Math.max(1, args.timeoutSeconds);
    if (args.whitelistRoles !== undefined) patch.whitelistRoles = args.whitelistRoles;
    if (args.heat !== undefined) patch.heat = Math.max(1, Math.min(100, args.heat));
    if (mod) {
      await ctx.db.patch(mod._id, patch);
    } else {
      const { actions, strongest } = normalizeActions(args.actions);
      const punish = args.punish ?? strongest ?? "kick";
      await ctx.db.insert("antinukeModules", {
        guildId: args.guildId,
        module: args.module,
        enabled: args.enabled ?? true,
        threshold: args.threshold ?? 5,
        windowSeconds: args.windowSeconds ?? 10,
        punish,
        actions: actions.length > 0 ? actions : [punish],
        timeoutSeconds: args.timeoutSeconds ?? 300,
        whitelistRoles: args.whitelistRoles ?? [],
        heat: args.heat ?? 10,
        updatedAt: Date.now(),
      });
    }
    return { ok: true };
  },
});


export const botUpdateLockdown = mutation({
  args: {
    guildId: v.string(),
    enabled: v.optional(v.boolean()),
    minutes: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const guild = await ctx.db
      .query("guilds")
      .withIndex("by_discordId", (q) => q.eq("discordId", args.guildId))
      .first();
    if (!guild) throw new Error("Server chưa được đồng bộ");
    const patch: Record<string, unknown> = { updatedAt: Date.now() };
    if (args.enabled !== undefined) patch.lockdownEnabled = args.enabled;
    if (args.minutes !== undefined) {
      patch.lockdownMinutes = Math.max(1, Math.min(120, Math.floor(args.minutes)));
    }
    await ctx.db.patch(guild._id, patch);
    return { ok: true };
  },
});


/** Bot records the current lockdown state (until = unlock timestamp, requested = manual unlock flag). */
export const botLockState = mutation({
  args: {
    guildId: v.string(),
    until: v.optional(v.union(v.number(), v.null())),
    requested: v.optional(v.boolean()),
  },
  handler: async (ctx, { guildId, until, requested }) => {
    const guild = await ctx.db
      .query("guilds")
      .withIndex("by_discordId", (q) => q.eq("discordId", guildId))
      .first();
    if (!guild) return { ok: true };
    const patch: Record<string, unknown> = { updatedAt: Date.now() };
    if (until !== undefined) patch.lockdownUntil = until ?? undefined;
    if (requested !== undefined) patch.lockdownRequested = requested;
    await ctx.db.patch(guild._id, patch);
    return { ok: true };
  },
});


/** Bot records a punished anti-nuke event for daily reports. */
export const botRecordAntinukeEvent = mutation({
  args: {
    guildId: v.string(),
    module: v.string(),
    executorId: v.optional(v.string()),
    executorName: v.optional(v.string()),
    action: v.string(),
    count: v.number(),
    windowSeconds: v.number(),
    threshold: v.number(),
    punish: v.string(),
  },
  handler: async (ctx, args) => {
    // Chống log "chồng chặp" trên dashboard: bot có thể kích hoạt 2 tầng cho cùng 1 vụ
    // (vd tầng audit IntegrationCreate + tầng tin nhắn app, hoặc pattern spam lặp lại trong
    // cửa sổ). Cùng guild + module + thủ phạm + count + ngưỡng ghi lại trong 5 giây
    // → coi là cùng 1 vụ, bỏ qua để feed "Hoạt động chống nuke" / "Lịch sử" không hiện trùng.
    const recent = await ctx.db
      .query("antinukeEvents")
      .withIndex("by_guildId_createdAt", (q) => q.eq("guildId", args.guildId))
      .order("desc")
      .take(10);
    const dup = recent.find(
      (r) =>
        Date.now() - r.createdAt < 5000 &&
        r.module === args.module &&
        r.executorId === args.executorId &&
        r.count === args.count &&
        r.threshold === args.threshold,
    );
    if (dup) return { ok: true, deduped: true };
    await ctx.db.insert("antinukeEvents", {
      guildId: args.guildId,
      module: args.module,
      executorId: args.executorId,
      executorName: args.executorName,
      executorNameLower: args.executorName ? args.executorName.toLowerCase() : undefined,
      action: args.action,
      count: args.count,
      windowSeconds: args.windowSeconds,
      threshold: args.threshold,
      punish: args.punish,
      createdAt: Date.now(),
    });
    // Chống phình DB: giữ tối đa 800 sự kiện/server — bảng này không giới hạn
    // độ dài lịch sử trên dashboard (GuildHistory phân trang, cũ hơn 800 tự xóa).
    const all = await ctx.db
      .query("antinukeEvents")
      .withIndex("by_guildId_createdAt", (q) => q.eq("guildId", args.guildId))
      .order("desc")
      .collect();
    if (all.length > 800) {
      const drop = all.slice(800).map((r) => r._id);
      for (const id of drop) await ctx.db.delete(id);
    }
    return { ok: true };
  },
});


/** Bot xóa cờ yêu cầu reset nhiệt sau khi đã dọn bộ nhớ. */
export const botClearHeatReset = mutation({
  args: { guildId: v.string() },
  handler: async (ctx, { guildId }) => {
    const guild = await ctx.db
      .query("guilds")
      .withIndex("by_discordId", (q) => q.eq("discordId", guildId))
      .first();
    if (!guild) return { ok: true };
    await ctx.db.patch(guild._id, {
      heatResetRequested: false,
      heatResetUserId: undefined,
      updatedAt: Date.now(),
    });
    return { ok: true };
  },
});


/** Bot records when the daily report for a guild was sent. */
export const botSetReportAt = mutation({
  args: { guildId: v.string(), at: v.number() },
  handler: async (ctx, { guildId, at }) => {
    const guild = await ctx.db
      .query("guilds")
      .withIndex("by_discordId", (q) => q.eq("discordId", guildId))
      .first();
    if (!guild) return { ok: true };
    await ctx.db.patch(guild._id, { lastReportAt: at, updatedAt: Date.now() });
    return { ok: true };
  },
});


/** Bot đảm bảo mọi module mặc định tồn tại cho một guild (thêm các module còn thiếu). */
export const botEnsureModules = mutation({
  args: { guildId: v.string() },
  handler: async (ctx, { guildId }) => {
    const guild = await ctx.db
      .query("guilds")
      .withIndex("by_discordId", (q) => q.eq("discordId", guildId))
      .first();
    if (!guild) return { ok: true };
    const existing = await ctx.db
      .query("antinukeModules")
      .withIndex("by_guildId", (q) => q.eq("guildId", guildId))
      .collect();
    const have = new Set(existing.map((m) => m.module));
    const now = Date.now();
    for (const m of ANTI_NUKE_MODULES) {
      if (have.has(m.module)) continue;
      await ctx.db.insert("antinukeModules", {
        guildId,
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
    return { ok: true };
  },
});


export const botSetAntinuke = mutation({
  args: { guildId: v.string(), enabled: v.boolean() },
  handler: async (ctx, { guildId, enabled }) => {
    const guild = await ctx.db
      .query("guilds")
      .withIndex("by_discordId", (q) => q.eq("discordId", guildId))
      .first();
    if (!guild) throw new Error("Server chưa được đồng bộ");
    await ctx.db.patch(guild._id, { antinukeEnabled: enabled, updatedAt: Date.now() });
    return { ok: true };
  },
});


/** Bot upserts the current heat level + warn strikes of one user in a guild. */
export const botRecordHeat = mutation({
  args: {
    guildId: v.string(),
    userId: v.string(),
    username: v.optional(v.string()),
    heat: v.number(),
    updatedAt: v.number(),
    warnStrikes: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("heatStates")
      .withIndex("by_guildId_userId", (q) =>
        q.eq("guildId", args.guildId).eq("userId", args.userId),
      )
      .first();
    const strikes = Math.max(0, Math.floor(args.warnStrikes ?? 0));
    // Cả nhiệt lẫn warn đều bằng 0 → xóa hàng cũ (dọn dẹp)
    if (args.heat <= 0 && strikes <= 0) {
      if (existing) await ctx.db.delete(existing._id);
      return { ok: true };
    }
    if (existing) {
      await ctx.db.patch(existing._id, {
        username: args.username ?? existing.username,
        heat: Math.max(1, Math.min(100, Math.round(args.heat))),
        updatedAt: args.updatedAt,
        warnStrikes: strikes,
      });
    } else {
      await ctx.db.insert("heatStates", {
        guildId: args.guildId,
        userId: args.userId,
        username: args.username ?? "",
        heat: Math.max(1, Math.min(100, Math.round(args.heat))),
        updatedAt: args.updatedAt,
        warnStrikes: strikes,
      });
    }
    return { ok: true };
  },
});


/** Bot lưu một backup cấu trúc server vào bảng guildBackups (giữ tối đa 3 bản/server). */
export const botStoreBackup = mutation({
  args: {
    guildId: v.string(),
    guildName: v.string(),
    backupJson: v.string(),
    roleCount: v.number(),
    channelCount: v.number(),
    messageCount: v.optional(v.number()),
    source: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const now = Date.now();
    const backupId = await ctx.db.insert("guildBackups", {
      guildId: args.guildId,
      guildName: args.guildName.slice(0, 120),
      backupJson: args.backupJson,
      roleCount: Math.max(0, Math.floor(args.roleCount)),
      channelCount: Math.max(0, Math.floor(args.channelCount)),
      messageCount: args.messageCount === undefined ? undefined : Math.max(0, Math.floor(args.messageCount)),
      source: args.source ?? undefined,
      pushedToGithub: false,
      createdAt: now,
    });
    // Đánh dấu lần backup gần nhất — lịch tự động tính từ đây.
    const guild = await ctx.db
      .query("guilds")
      .withIndex("by_discordId", (q) => q.eq("discordId", args.guildId))
      .first();
    if (guild) {
      await ctx.db.patch(guild._id, { lastBackupAt: now, updatedAt: now });
    }
    // Tự dọn dẹp backup tồn dư: chỉ giữ 3 bản mới nhất mỗi server (bản cũ hơn bị xóa).
    const all = await ctx.db
      .query("guildBackups")
      .withIndex("by_guildId", (q) => q.eq("guildId", args.guildId))
      .collect();
    const drop = all.sort((a, b) => b.createdAt - a.createdAt).slice(3).map((r) => r._id);
    for (const id of drop) await ctx.db.delete(id);
    return { ok: true, backupId };
  },
});

/** Action backup:githubPush cập nhật URL gist sau khi đẩy thành công. */
export const botSetBackupGithub = mutation({
  args: { backupId: v.id("guildBackups"), url: v.string() },
  handler: async (ctx, { backupId, url }) => {
    const backup = await ctx.db.get(backupId);
    if (!backup) return { ok: true };
    await ctx.db.patch(backup._id, {
      githubUrl: url.slice(0, 500),
      pushedToGithub: true,
    });
    return { ok: true };
  },
});

/** Bot (lệnh !backup auto / /backup auto) bật/tắt tự động backup theo số ngày (2-30, 0 = tắt). */
export const botSetAutoBackup = mutation({
  args: { guildId: v.string(), days: v.number() },
  handler: async (ctx, { guildId, days }) => {
    const guild = await ctx.db
      .query("guilds")
      .withIndex("by_discordId", (q) => q.eq("discordId", guildId))
      .first();
    if (!guild) throw new Error("Server chưa được đồng bộ");
    const next = days <= 0 ? 0 : Math.max(2, Math.min(30, Math.floor(days)));
    await ctx.db.patch(guild._id, {
      backupAutoDays: next,
      updatedAt: Date.now(),
    });
    return { ok: true, days: next };
  },
});

/** Bot (lệnh !backup / /backup) đặt cờ yêu cầu tạo backup — vòng quét 20s sẽ thực hiện. */
export const botSetBackupRequest = mutation({
  args: { guildId: v.string(), pushToGithub: v.optional(v.boolean()) },
  handler: async (ctx, { guildId, pushToGithub }) => {
    const guild = await ctx.db
      .query("guilds")
      .withIndex("by_discordId", (q) => q.eq("discordId", guildId))
      .first();
    if (!guild) throw new Error("Server chưa được đồng bộ");
    if (!guild.botInGuild) throw new Error("Bot chưa có trong server này");
    await ctx.db.patch(guild._id, {
      backupRequested: true,
      backupPushToGithub: !!pushToGithub,
      backupClaimedAt: undefined,
      updatedAt: Date.now(),
    });
    return { ok: true };
  },
});

/** Bot (lệnh !backup restore / /backup restore) đặt cờ khôi phục cho một backup của đúng guild đó. */
export const botSetRestoreRequest = mutation({
  args: { guildId: v.string(), backupId: v.id("guildBackups") },
  handler: async (ctx, { guildId, backupId }) => {
    const guild = await ctx.db
      .query("guilds")
      .withIndex("by_discordId", (q) => q.eq("discordId", guildId))
      .first();
    if (!guild) throw new Error("Server chưa được đồng bộ");
    if (!guild.botInGuild) throw new Error("Bot chưa có trong server này");
    const backup = await ctx.db.get(backupId);
    if (!backup || backup.guildId !== guildId) {
      throw new Error("Backup không tồn tại hoặc không thuộc server này");
    }
    await ctx.db.patch(guild._id, {
      restoreRequested: true,
      restoreBackupId: backupId,
      restoreClaimedAt: undefined,
      updatedAt: Date.now(),
    });
    return { ok: true };
  },
});

/**
 * Bot giành quyền xử lý một yêu cầu backup/khôi phục (chống lặp).
 * Chỉ bot claim THÀNH CÔNG mới được chạy; lượt quét khác/instance khác
 * gọi tới trong 2 phút sẽ bị từ chối và bỏ qua, không tạo backup trùng.
 */
export const botClaimBackup = mutation({
  args: {
    guildId: v.string(),
    kind: v.union(v.literal("backup"), v.literal("restore"), v.literal("import")),
  },
  handler: async (ctx, { guildId, kind }) => {
    const guild = await ctx.db
      .query("guilds")
      .withIndex("by_discordId", (q) => q.eq("discordId", guildId))
      .first();
    if (!guild) return { ok: false, reason: "no_guild" };
    const now = Date.now();
    if (kind === "backup") {
      if (!guild.backupRequested) return { ok: false, reason: "no_request" };
      if (
        guild.backupClaimedAt !== undefined &&
        now - guild.backupClaimedAt < 120_000
      ) {
        return { ok: false, reason: "in_flight" };
      }
      await ctx.db.patch(guild._id, { backupClaimedAt: now, updatedAt: now });
      return { ok: true };
    }
    if (kind === "import") {
      if (!guild.importRestoreRequested) return { ok: false, reason: "no_request" };
      if (
        guild.restoreClaimedAt !== undefined &&
        now - guild.restoreClaimedAt < 120_000
      ) {
        return { ok: false, reason: "in_flight" };
      }
      await ctx.db.patch(guild._id, { restoreClaimedAt: now, updatedAt: now });
      return { ok: true };
    }
    if (!guild.restoreRequested) return { ok: false, reason: "no_request" };
    if (
      guild.restoreClaimedAt !== undefined &&
      now - guild.restoreClaimedAt < 120_000
    ) {
      return { ok: false, reason: "in_flight" };
    }
    await ctx.db.patch(guild._id, { restoreClaimedAt: now, updatedAt: now });
    return { ok: true };
  },
});

/** Bot xóa cờ yêu cầu backup/khôi phục sau khi đã xử lý xong. */
export const botClearBackup = mutation({
  args: {
    guildId: v.string(),
    kind: v.union(v.literal("backup"), v.literal("restore"), v.literal("import")),
  },
  handler: async (ctx, { guildId, kind }) => {
    const guild = await ctx.db
      .query("guilds")
      .withIndex("by_discordId", (q) => q.eq("discordId", guildId))
      .first();
    if (!guild) return { ok: true };
    const patch: Record<string, unknown> = { updatedAt: Date.now() };
    if (kind === "backup") {
      patch.backupRequested = false;
      patch.backupPushToGithub = false;
      patch.backupClaimedAt = undefined;
    } else if (kind === "import") {
      patch.importRestoreRequested = false;
      patch.importFileName = undefined;
      patch.importFileContent = undefined;
      patch.restoreClaimedAt = undefined;
    } else {
      patch.restoreRequested = false;
      patch.restoreBackupId = undefined;
      patch.restoreClaimedAt = undefined;
    }
    await ctx.db.patch(guild._id, patch);
    return { ok: true };
  },
});

/** Bot ghi lại cấu hình cơ bản sau khi khôi phục backup (role/kênh đã map sang id mới). */
export const botRestoreSettings = mutation({
  args: {
    guildId: v.string(),
    prefix: v.optional(v.string()),
    badWords: v.optional(v.array(v.string())),
    whitelistRoles: v.optional(v.array(v.string())),
    whitelistUsers: v.optional(v.array(v.string())),
    modRoles: v.optional(v.array(v.string())),
    adminRoles: v.optional(v.array(v.string())),
    logChannelId: v.optional(v.union(v.string(), v.null())),
    modLogChannelId: v.optional(v.union(v.string(), v.null())),
  },
  handler: async (ctx, args) => {
    const guild = await ctx.db
      .query("guilds")
      .withIndex("by_discordId", (q) => q.eq("discordId", args.guildId))
      .first();
    if (!guild) throw new Error("Server chưa được đồng bộ");
    const patch: Record<string, unknown> = { updatedAt: Date.now() };
    if (args.prefix !== undefined) patch.prefix = args.prefix;
    if (args.badWords !== undefined) patch.badWords = args.badWords.slice(0, 100);
    if (args.whitelistRoles !== undefined) patch.whitelistRoles = args.whitelistRoles.slice(0, 100);
    if (args.whitelistUsers !== undefined) patch.whitelistUsers = args.whitelistUsers.slice(0, 100);
    if (args.modRoles !== undefined) patch.modRoles = args.modRoles.slice(0, 50);
    if (args.adminRoles !== undefined) patch.adminRoles = args.adminRoles.slice(0, 50);
    if (args.logChannelId !== undefined) patch.logChannelId = args.logChannelId ?? undefined;
    if (args.modLogChannelId !== undefined) patch.modLogChannelId = args.modLogChannelId ?? undefined;
    await ctx.db.patch(guild._id, patch);
    return { ok: true };
  },
});


export const botRecordModAction = mutation({
  args: {
    guildId: v.string(),
    action: v.string(),
    targetId: v.optional(v.string()),
    targetName: v.optional(v.string()),
    executorId: v.optional(v.string()),
    executorName: v.optional(v.string()),
    reason: v.optional(v.string()),
    details: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const now = Date.now();
    // Số case tăng dần của server (kiểu Carl-bot): bắt đầu từ số case đã có nếu chưa ghi.
    const guild = await ctx.db
      .query("guilds")
      .withIndex("by_discordId", (q) => q.eq("discordId", args.guildId))
      .first();
    let counter = guild?.modCaseCounter ?? 0;
    if (guild?.modCaseCounter === undefined) {
      const existing = await ctx.db
        .query("modActions")
        .withIndex("by_guildId", (q) => q.eq("guildId", args.guildId))
        .collect();
      counter = existing.length;
    }
    const caseNumber = counter + 1;
    if (guild) {
      await ctx.db.patch(guild._id, { modCaseCounter: caseNumber, updatedAt: now });
    }
    await ctx.db.insert("modActions", {
      guildId: args.guildId,
      action: args.action.slice(0, 30),
      targetId: args.targetId ?? undefined,
      targetName: args.targetName ? args.targetName.slice(0, 80) : undefined,
      executorId: args.executorId ?? undefined,
      executorName: args.executorName ? args.executorName.slice(0, 80) : undefined,
      reason: args.reason ? args.reason.slice(0, 500) : undefined,
      details: args.details ? args.details.slice(0, 200) : undefined,
      caseNumber,
      createdAt: now,
    });
    const extras = await ctx.db
      .query("modActions")
      .withIndex("by_guildId", (q) => q.eq("guildId", args.guildId))
      .collect();
    const drop = extras
      .sort((a, b) => b.createdAt - a.createdAt)
      .slice(100)
      .map((r) => r._id);
    for (const id of drop) await ctx.db.delete(id);
    return { ok: true, caseNumber };
  },
});


/** Bot ghi một mẫu dữ liệu raid/nuke (Raid Intel — dữ liệu huấn luyện). */
export const botRecordRaidSample = mutation({
  args: {
    guildId: v.string(),
    guildName: v.optional(v.string()),
    module: v.string(),
    count: v.number(),
    windowSeconds: v.number(),
    threshold: v.number(),
    action: v.optional(v.string()),
    punish: v.optional(v.string()),
    aiClassification: v.optional(v.string()),
    aiConfidence: v.optional(v.number()),
    aiReason: v.optional(v.string()),
    lockdownTriggered: v.optional(v.boolean()),
    punishedCount: v.optional(v.number()),
    clusterMemberCount: v.optional(v.number()),
    clusterAvgAccountAgeDays: v.optional(v.number()),
    clusterSharedAvatarCount: v.optional(v.number()),
    clusterJoinBurstSeconds: v.optional(v.number()),
    /** External App Guard: danh sách app được kết nối trong vụ (tên app + người kết nối). */
    apps: v.optional(
      v.array(
        v.object({
          appName: v.optional(v.string()),
          executorName: v.optional(v.string()),
          executorId: v.optional(v.string()),
        }),
      ),
    ),
    /** External App Guard: người dùng đã bị xử lý trong vụ (ban/kick/warn…). */
    punished: v.optional(
      v.array(
        v.object({
          userId: v.optional(v.string()),
          username: v.optional(v.string()),
          action: v.optional(v.string()),
        }),
      ),
    ),
    sourceHunt: v.optional(
      v.object({
        suspectedSourceId: v.optional(v.string()),
        suspectedSourceName: v.optional(v.string()),
        reason: v.string(),
        banned: v.boolean(),
        confidence: v.number(),
      }),
    ),
  },
  handler: async (ctx, args) => {
    // Chống log "chồng chặp" trên tab Raid external app / Raid Intel: cùng guild + module +
    // count + ngưỡng ghi lại trong 5 giây → cùng 1 vụ (bot kích hoạt 2 tầng), bỏ qua.
    const recent = await ctx.db
      .query("raidSamples")
      .withIndex("by_guildId_createdAt", (q) => q.eq("guildId", args.guildId))
      .order("desc")
      .take(10);
    const dup = recent.find(
      (r) =>
        Date.now() - r.createdAt < 5000 &&
        r.module === args.module &&
        r.count === args.count &&
        r.threshold === args.threshold,
    );
    if (dup) return { ok: true, deduped: true };
    await ctx.db.insert("raidSamples", {
      guildId: args.guildId,
      guildName: args.guildName,
      module: args.module,
      count: args.count,
      windowSeconds: args.windowSeconds,
      threshold: args.threshold,
      action: args.action,
      punish: args.punish,
      aiClassification: args.aiClassification,
      aiConfidence: args.aiConfidence,
      aiReason: args.aiReason,
      lockdownTriggered: args.lockdownTriggered,
      punishedCount: args.punishedCount,
      clusterMemberCount: args.clusterMemberCount,
      clusterAvgAccountAgeDays: args.clusterAvgAccountAgeDays,
      clusterSharedAvatarCount: args.clusterSharedAvatarCount,
      clusterJoinBurstSeconds: args.clusterJoinBurstSeconds,
      apps: args.apps,
      punished: args.punished,
      sourceHunt: args.sourceHunt,
      createdAt: Date.now(),
    });
    // Chống phình DB: giữ tối đa 500 mẫu/server — đủ làm bộ dữ liệu huấn luyện
    // mà không làm chậm dashboard.
    const all = await ctx.db
      .query("raidSamples")
      .withIndex("by_guildId_createdAt", (q) => q.eq("guildId", args.guildId))
      .order("desc")
      .collect();
    if (all.length > 500) {
      const drop = all.slice(500).map((r) => r._id);
      for (const id of drop) await ctx.db.delete(id);
    }
    return { ok: true };
  },
});
