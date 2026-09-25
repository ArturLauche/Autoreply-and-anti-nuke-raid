import { mutation, query } from "./_generated/server";
import type { Id } from "./_generated/dataModel";
import { v } from "convex/values";
import { getUserByToken, canManageGuild, guildAccessibleBy } from "./auth";
import { requireBotKeyStrict } from "./botAuth";
import { getBotStatus, hiddenPasswordIsSet, isBotOwnerUser } from "./hidden";
import {
  ANTI_NUKE_MODULES,
  HEAT_DEFAULTS,
  MODULE_HEAT_DEFAULTS,
  WARN_STRIKE_DEFAULTS,
} from "./modules";

/**
 * Làm sạch field embed welcome/goodbye v2: màu phải #hex (3/4/6 ký tự), ảnh
 * phải URL http(s) hợp lệ. Giá trị rác từ dashboard bị NUÔT thay vì lưu dơ —
 * bot gửi embed sẽ lỗi nếu màu không parse được.
 */
function cleanGreetingField(field: string, val: string): string | undefined {
  const s = val.trim();
  if (!s) return undefined;
  if (field.endsWith("Color")) return /^#[0-9a-fA-F]{3,8}$/.test(s) ? s.toLowerCase() : undefined;
  return /^https?:\/\/\S+$/.test(s) && s.length <= 2000 ? s : undefined;
}

/** Decay a stored heat value by the guild's per-minute decay rate. */
function decayHeat(heat: number, updatedAt: number, decayPerMin: number) {
  const elapsedMin = (Date.now() - updatedAt) / 60000;
  return Math.max(0, Math.round(heat - elapsedMin * decayPerMin));
}

async function loadHeatStates(
  ctx: { db: import("./_generated/server").DatabaseReader },
  guildId: string,
  decayPerMin: number,
) {
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
    // TỐI ƯU (audit Convex): index by_botInGuild — hot-path mở dashboard.
    const all = await ctx.db
      .query("guilds")
      .withIndex("by_botInGuild", (q) => q.eq("botInGuild", true))
      .collect();
    // Chỉ hiện server bot đang đứng trong (server đã xóa/kick bot sẽ tự biến mất).
    return all
      .filter((g) => guildAccessibleBy(user, g))
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
    // Emoji tuỳ chỉnh của server — panel welcome/goodbye dùng làm picker chèn emoji.
    const emojis = await ctx.db
      .query("guildEmojis")
      .withIndex("by_guildId", (q) => q.eq("guildId", guildId))
      .collect();
    const decayPerMin = guild.heatDecayPerMin ?? HEAT_DEFAULTS.decayPerMin;
    const heatStates = await loadHeatStates(ctx, guildId, decayPerMin);
    const safetyPercent = Math.max(0, Math.min(100, 100 - (heatStates[0]?.heat ?? 0)));
    const botStatus = await ctx.db
      .query("botStatus")
      .withIndex("by_kind", (q) => q.eq("kind", "status"))
      .first();
    const ownerDiscordId = botStatus?.ownerDiscordId;
    const isBotOwner = isBotOwnerUser(user, botStatus);
    const panels = (
      await ctx.db
        .query("reactionRolePanels")
        .withIndex("by_guildId", (q) => q.eq("guildId", guildId))
        .collect()
    ).sort((a, b) => b.createdAt - a.createdAt);
    const giveaways = (
      await ctx.db
        .query("giveaways")
        .withIndex("by_guildId", (q) => q.eq("guildId", guildId))
        .collect()
    )
      .sort((a, b) => b.createdAt - a.createdAt)
      .slice(0, 30);
    const modActions = await ctx.db
      .query("modActions")
      .withIndex("by_guildId_createdAt", (q) => q.eq("guildId", guildId))
      .order("desc")
      .take(30);
    return {
      guild: {
        discordId: guild.discordId,
        name: guild.name,
        icon: guild.icon ?? null,
        memberCount: guild.memberCount ?? null,
        prefix: guild.prefix,
        logChannelId: guild.logChannelId ?? null,
        modLogChannelId: guild.modLogChannelId ?? null,
        punishNoticeChannelId: guild.punishNoticeChannelId ?? null,
        punishNotice: {
          ban: guild.punishNotice?.ban ?? "full",
          timeout: guild.punishNotice?.timeout ?? "full",
          kick: guild.punishNotice?.kick ?? "full",
          warn: guild.punishNotice?.warn ?? "full",
        },
        whitelistUsers: guild.whitelistUsers ?? [],
        whitelistRoles: guild.whitelistRoles ?? [],
        // Cổng mật khẩu ẩn là TOÀN CỤC (thuộc chủ bot, không thuộc server này) →
        // mọi server đều báo cùng trạng thái, không còn cảnh server có mật khẩu
        // thì khoá còn server khác thì mở toang.
        hiddenPasswordSet: await hiddenPasswordIsSet(ctx),
        isBotOwner,
        botOwnerSet: !!ownerDiscordId,
        theme: guild.theme ?? "graphite",
        backupAutoDays: guild.backupAutoDays ?? 0,
        lastBackupAt: guild.lastBackupAt ?? null,
        restoreRolesEnabled: guild.restoreRolesEnabled ?? true,
        restoreChannelsEnabled: guild.restoreChannelsEnabled ?? true,
        restoreMessagesEnabled: guild.restoreMessagesEnabled ?? true,
        restoreEmojisEnabled: guild.restoreEmojisEnabled ?? true,
        raidHuntEnabled: guild.raidHuntEnabled ?? true,
        raidHuntBanSuspects: guild.raidHuntBanSuspects ?? true,
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
        emergencyAlertEnabled: guild.emergencyAlertEnabled ?? true,
        logPingEveryone: guild.logPingEveryone ?? true,
        badWords: guild.badWords ?? [],
        // Welcome/Goodbye + Autorole — panel WelcomePanel đọc TRỰC TIẾP các field này
        // từ `data.guild`. Thiếu ở đây (bug thật 23/09) thì dashboard luôn hiển thị
        // trạng thái rỗng: công tắc trông như không bật được, kênh/nội dung đã lưu
        // không hiện ra, và mỗi lượt bấm "Lưu cài đặt" lại ghi đè bằng chuỗi rỗng →
        // bot không bao giờ gửi lời chào. Danh sách này PHẢI khớp `GuildData.guild`
        // trong src/lib/types.ts — test-guild-panel-contract.cjs chốt hạ.
        welcomeEnabled: guild.welcomeEnabled ?? false,
        welcomeChannelId: guild.welcomeChannelId ?? null,
        welcomeMessage: guild.welcomeMessage ?? null,
        welcomeUseEmbed: guild.welcomeUseEmbed ?? true,
        goodbyeEnabled: guild.goodbyeEnabled ?? false,
        goodbyeChannelId: guild.goodbyeChannelId ?? null,
        goodbyeMessage: guild.goodbyeMessage ?? null,
        goodbyeUseEmbed: guild.goodbyeUseEmbed ?? true,
        welcomeRandom: guild.welcomeRandom ?? null,
        goodbyeRandom: guild.goodbyeRandom ?? null,
        welcomeDmEnabled: guild.welcomeDmEnabled ?? false,
        welcomeDmMessage: guild.welcomeDmMessage ?? null,
        welcomeEmbedTitle: guild.welcomeEmbedTitle ?? null,
        welcomeEmbedColor: guild.welcomeEmbedColor ?? null,
        welcomeEmbedImage: guild.welcomeEmbedImage ?? null,
        welcomeEmbedThumbnail: guild.welcomeEmbedThumbnail ?? null,
        goodbyeEmbedTitle: guild.goodbyeEmbedTitle ?? null,
        goodbyeEmbedColor: guild.goodbyeEmbedColor ?? null,
        goodbyeEmbedImage: guild.goodbyeEmbedImage ?? null,
        goodbyeEmbedThumbnail: guild.goodbyeEmbedThumbnail ?? null,
        autoroleEnabled: guild.autoroleEnabled ?? false,
        autoroleRoleId: guild.autoroleRoleId ?? null,
        autoroleDelaySec: guild.autoroleDelaySec ?? 0,
        autoroleIncludeBots: guild.autoroleIncludeBots ?? false,
        // Thẻ ảnh v3 — panel đọc trực tiếp từ `data.guild` (xem test-guild-panel-contract).
        welcomeCardEnabled: guild.welcomeCardEnabled ?? false,
        welcomeCardBackground: guild.welcomeCardBackground ?? null,
        goodbyeCardEnabled: guild.goodbyeCardEnabled ?? false,
        goodbyeCardBackground: guild.goodbyeCardBackground ?? null,
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
        verifyEnabled: guild.verifyEnabled ?? false,
        verifyMethod: guild.verifyMethod ?? "button",
        verifyChannelId: guild.verifyChannelId ?? null,
        unverifiedRoleId: guild.unverifiedRoleId ?? null,
        verifiedRoleId: guild.verifiedRoleId ?? null,
        verifyWelcomeEnabled: guild.verifyWelcomeEnabled ?? false,
        verifyWelcomeTitle: guild.verifyWelcomeTitle ?? null,
        verifyWelcomeDescription: guild.verifyWelcomeDescription ?? null,
        verifyWelcomeColor: guild.verifyWelcomeColor ?? null,
        verifySendPanel: guild.verifySendPanel ?? false,
        /** Lỗi gửi panel xác minh gần nhất (bot báo lại — web hiển thị thay vì im lặng). */
        verifyPanelError: guild.verifyPanelError ?? null,
        verifyPanelErrorAt: guild.verifyPanelErrorAt ?? null,
        /** Lỗi gửi DM trực tiếp gần nhất (bot báo lại — web hiển thị thay vì im lặng). */
        dmError: guild.dmError ?? null,
        dmErrorAt: guild.dmErrorAt ?? null,
      },
      heatStates,
      modules: modules.map((m) => ({
        module: m.module,
        enabled: m.enabled,
        threshold: m.threshold,
        windowSeconds: m.windowSeconds,
        punish: m.punish,
        actions: m.actions && m.actions.length > 0 ? m.actions : [m.punish],
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
      // Emoji tuỳ chỉnh — panel tự dựng mã `<:name:id>` / `<a:name:id>` khi chèn.
      emojis: emojis
        .map((e) => ({ emojiId: e.emojiId, name: e.name, animated: e.animated }))
        .sort((a, b) => a.name.localeCompare(b.name)),
      /**
       * Khả năng vẽ thẻ ảnh chào của MÁY CHỦ BOT (không thuộc server nào) — bot tự
       * báo qua `status:reportCardCapability`. `null` = chưa báo (bản cũ/chưa khởi
       * động lại) → panel KHÔNG được kết luận là hỏng.
       */
      botCardReady: botStatus?.cardReady ?? null,
      botCardReason: botStatus?.cardUnavailableReason ?? null,
      // TÍNH NĂNG ẨN — chỉ trả cho CHỦ BOT (lỗ hổng cũ: mọi manager xem được,
      // trong khi API tạo/xóa lại chỉ cho owner → dữ liệu lệch trạng thái + lộ nội dung).
      panels: isBotOwner
        ? panels.map((p) => ({
            _id: p._id,
            channelId: p.channelId,
            label: p.label,
            description: p.description ?? null,
            thumbnailUrl: p.thumbnailUrl ?? null,
            entries: p.entries,
            messageId: p.messageId ?? "",
            postError: p.postError ?? null,
            postErrorAt: p.postErrorAt ?? null,
            enabled: p.enabled,
            createdAt: p.createdAt,
          }))
        : [],
      modActions: modActions.map((m) => ({
        _id: m._id,
        action: m.action,
        targetId: m.targetId ?? null,
        targetName: m.targetName ?? null,
        executorId: m.executorId ?? null,
        executorName: m.executorName ?? null,
        reason: m.reason ?? null,
        details: m.details ?? null,
        caseNumber: m.caseNumber ?? null,
        createdAt: m.createdAt,
      })),
      giveaways: isBotOwner
        ? giveaways.map((g) => ({
            _id: g._id,
            channelId: g.channelId,
            title: g.title,
            prize: g.prize,
            winnerCount: g.winnerCount,
            durationMinutes: g.durationMinutes,
            endsAt: g.endsAt,
            dmWinners: g.dmWinners,
            requiredRoleId: g.requiredRoleId ?? null,
            prizeRoleId: g.prizeRoleId ?? null,
            template: g.template ?? "default",
            message: g.message ?? null,
            imageUrl: g.imageUrl ?? null,
            endMessage: g.endMessage ?? null,
            status: g.status,
            messageId: g.messageId ?? "",
            postError: g.postError ?? null,
            postErrorAt: g.postErrorAt ?? null,
            endError: g.endError ?? null,
            endErrorAt: g.endErrorAt ?? null,
            entriesCount: g.entries.length,
            winners: g.winners,
            createdAt: g.createdAt,
          }))
        : [],
      // Auto-reply là tính năng ẩn (botCreate khi setup) → chỉ owner xem được.
      autoReplies: isBotOwner
        ? autoReplies.map((r) => ({
            _id: r._id,
            name: r.name,
            triggerType: r.triggerType,
            keywords: r.keywords,
            response: r.response,
            channels: r.channels,
            cooldownSeconds: r.cooldownSeconds,
            enabled: r.enabled,
            createdAt: r.createdAt,
          }))
        : [],
    };
  },
});

/** Lightweight config bundle that the Discord bot fetches per guild. */
export const getBotConfig = query({
  args: {
    guildId: v.string(),
    /** Chìa khóa bot (botAuth) — chỉ bot có OWNER_SEED mới tính được. */
    botKey: v.optional(v.string()),
  },
  handler: async (ctx, { botKey, guildId }) => {
    await requireBotKeyStrict(ctx, botKey);
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
    const giveaways = await ctx.db
      .query("giveaways")
      .withIndex("by_guildId", (q) => q.eq("guildId", guildId))
      .order("desc")
      .take(20);
    return {
      prefix: guild.prefix,
      logChannelId: guild.logChannelId ?? null,
      modLogChannelId: guild.modLogChannelId ?? null,
      punishNoticeChannelId: guild.punishNoticeChannelId ?? null,
      punishNotice: {
        ban: guild.punishNotice?.ban ?? "full",
        timeout: guild.punishNotice?.timeout ?? "full",
        kick: guild.punishNotice?.kick ?? "full",
        warn: guild.punishNotice?.warn ?? "full",
      },
      whitelistUsers: guild.whitelistUsers ?? [],
      whitelistRoles: guild.whitelistRoles ?? [],
      modRoles: guild.modRoles,
      adminRoles: guild.adminRoles,
      antinukeEnabled: guild.antinukeEnabled,
      lockdownEnabled: guild.lockdownEnabled ?? true,
      lockdownMinutes: guild.lockdownMinutes ?? 5,
      lockdownUntil: guild.lockdownUntil ?? null,
      lockdownRequested: guild.lockdownRequested ?? false,
      dailyReportEnabled: guild.dailyReportEnabled ?? true,
      emergencyAlertEnabled: guild.emergencyAlertEnabled ?? true,
      logPingEveryone: guild.logPingEveryone ?? true,
      // Welcome/Goodbye — bot gửi chào/tạm biệt theo config dashboard.
      welcomeEnabled: guild.welcomeEnabled ?? false,
      welcomeChannelId: guild.welcomeChannelId ?? null,
      welcomeMessage: guild.welcomeMessage ?? null,
      welcomeUseEmbed: guild.welcomeUseEmbed ?? true,
      goodbyeEnabled: guild.goodbyeEnabled ?? false,
      goodbyeChannelId: guild.goodbyeChannelId ?? null,
      goodbyeMessage: guild.goodbyeMessage ?? null,
      goodbyeUseEmbed: guild.goodbyeUseEmbed ?? true,
      // Welcome/Goodbye v2 — bot đọc từ getConfig (guilds:botGetConfig đọc raw doc).
      welcomeRandom: guild.welcomeRandom ?? null,
      goodbyeRandom: guild.goodbyeRandom ?? null,
      welcomeDmEnabled: guild.welcomeDmEnabled ?? false,
      welcomeDmMessage: guild.welcomeDmMessage ?? null,
      welcomeEmbedTitle: guild.welcomeEmbedTitle ?? null,
      welcomeEmbedColor: guild.welcomeEmbedColor ?? null,
      welcomeEmbedImage: guild.welcomeEmbedImage ?? null,
      welcomeEmbedThumbnail: guild.welcomeEmbedThumbnail ?? null,
      goodbyeEmbedTitle: guild.goodbyeEmbedTitle ?? null,
      goodbyeEmbedColor: guild.goodbyeEmbedColor ?? null,
      goodbyeEmbedImage: guild.goodbyeEmbedImage ?? null,
      goodbyeEmbedThumbnail: guild.goodbyeEmbedThumbnail ?? null,
      autoroleEnabled: guild.autoroleEnabled ?? false,
      autoroleRoleId: guild.autoroleRoleId ?? null,
      autoroleDelaySec: guild.autoroleDelaySec ?? 0,
      autoroleIncludeBots: guild.autoroleIncludeBots ?? false,
      // Thẻ ảnh v3 — bot đọc từ getBotConfig để tự vẽ PNG.
      welcomeCardEnabled: guild.welcomeCardEnabled ?? false,
      welcomeCardBackground: guild.welcomeCardBackground ?? null,
      goodbyeCardEnabled: guild.goodbyeCardEnabled ?? false,
      goodbyeCardBackground: guild.goodbyeCardBackground ?? null,
      restoreRolesEnabled: guild.restoreRolesEnabled ?? true,
      restoreChannelsEnabled: guild.restoreChannelsEnabled ?? true,
      restoreMessagesEnabled: guild.restoreMessagesEnabled ?? true,
      restoreEmojisEnabled: guild.restoreEmojisEnabled ?? true,
      lastReportAt: guild.lastReportAt ?? null,
      raidHuntEnabled: guild.raidHuntEnabled ?? true,
      raidHuntBanSuspects: guild.raidHuntBanSuspects ?? true,
      badWords: guild.badWords ?? [],
      // Trần punish tự động/phút — actionBudget.js đọc field này; preset ghi vào
      // DB nhưng nếu query không trả về thì bot luôn dùng mặc định (20).
      actionBudgetPerMinute: guild.actionBudgetPerMinute ?? 20,
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
      dmRequested: guild.dmRequested ?? false,
      dmTargetUserId: guild.dmTargetUserId ?? null,
      dmTargetUsername: guild.dmTargetUsername ?? null,
      dmMessage: guild.dmMessage ?? null,
      backupAutoDays: guild.backupAutoDays ?? 0,
      verifyEnabled: guild.verifyEnabled ?? false,
      verifyMethod: guild.verifyMethod ?? "button",
      verifyChannelId: guild.verifyChannelId ?? null,
      unverifiedRoleId: guild.unverifiedRoleId ?? null,
      verifiedRoleId: guild.verifiedRoleId ?? null,
      verifyWelcomeEnabled: guild.verifyWelcomeEnabled ?? false,
      verifyWelcomeTitle: guild.verifyWelcomeTitle ?? null,
      verifyWelcomeDescription: guild.verifyWelcomeDescription ?? null,
      verifyWelcomeColor: guild.verifyWelcomeColor ?? null,
      verifySendPanel: guild.verifySendPanel ?? false,
      // Alt account + VPN detection — bot cần đủ các field này để joinGate chạy
      altDetectionEnabled: guild.altDetectionEnabled ?? false,
      vpnBlockEnabled: guild.vpnBlockEnabled ?? false,
      altMinAgeDays: guild.altMinAgeDays ?? 7,
      altMaxRiskScore: guild.altMaxRiskScore ?? 70,
      altPunish: guild.altPunish ?? "kick",
      altTimeoutMinutes: guild.altTimeoutMinutes ?? 60,
      altWhitelistRoles: guild.altWhitelistRoles ?? [],
      altWhitelistUsers: guild.altWhitelistUsers ?? [],
      altSimilarityThreshold: guild.altSimilarityThreshold ?? 70,
      altJoinWindowMinutes: guild.altJoinWindowMinutes ?? 5,
      altVpnMode: guild.altVpnMode ?? "off",
      altSafeMode: guild.altSafeMode ?? true,
      heatStates,
      autoReplies,
      giveaways: giveaways.map((g) => ({
        title: g.title,
        status: g.status,
        endsAt: g.endsAt,
        entries: g.entries,
      })),
      modules: modules.map((m) => ({
        module: m.module,
        enabled: m.enabled,
        threshold: m.threshold,
        windowSeconds: m.windowSeconds,
        punish: m.punish,
        actions: m.actions && m.actions.length > 0 ? m.actions : [m.punish],
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
    modLogChannelId: v.optional(v.string()),
    punishNoticeChannelId: v.optional(v.string()),
    punishNotice: v.optional(
      v.object({
        ban: v.string(),
        timeout: v.string(),
        kick: v.string(),
        warn: v.string(),
      }),
    ),
    whitelistUsers: v.optional(v.array(v.string())),
    whitelistRoles: v.optional(v.array(v.string())),
    modRoles: v.optional(v.array(v.string())),
    adminRoles: v.optional(v.array(v.string())),
    dailyReportEnabled: v.optional(v.boolean()),
    emergencyAlertEnabled: v.optional(v.boolean()),
    logPingEveryone: v.optional(v.boolean()),
    // Welcome/Goodbye — dashboard cấu hình chào thành viên mới / tạm biệt.
    welcomeEnabled: v.optional(v.boolean()),
    welcomeChannelId: v.optional(v.union(v.string(), v.null())),
    welcomeMessage: v.optional(v.union(v.string(), v.null())),
    welcomeUseEmbed: v.optional(v.boolean()),
    goodbyeEnabled: v.optional(v.boolean()),
    goodbyeChannelId: v.optional(v.union(v.string(), v.null())),
    goodbyeMessage: v.optional(v.union(v.string(), v.null())),
    goodbyeUseEmbed: v.optional(v.boolean()),
    // Welcome/Goodbye v2 — template ngẫu nhiên, DM, embed tùy chỉnh, autorole.
    welcomeRandom: v.optional(v.union(v.string(), v.null())),
    goodbyeRandom: v.optional(v.union(v.string(), v.null())),
    welcomeDmEnabled: v.optional(v.boolean()),
    welcomeDmMessage: v.optional(v.union(v.string(), v.null())),
    welcomeEmbedTitle: v.optional(v.union(v.string(), v.null())),
    welcomeEmbedColor: v.optional(v.union(v.string(), v.null())),
    welcomeEmbedImage: v.optional(v.union(v.string(), v.null())),
    welcomeEmbedThumbnail: v.optional(v.union(v.string(), v.null())),
    goodbyeEmbedTitle: v.optional(v.union(v.string(), v.null())),
    goodbyeEmbedColor: v.optional(v.union(v.string(), v.null())),
    goodbyeEmbedImage: v.optional(v.union(v.string(), v.null())),
    goodbyeEmbedThumbnail: v.optional(v.union(v.string(), v.null())),
    autoroleEnabled: v.optional(v.boolean()),
    autoroleRoleId: v.optional(v.union(v.string(), v.null())),
    autoroleDelaySec: v.optional(v.number()),
    autoroleIncludeBots: v.optional(v.boolean()),
    // Thẻ ảnh v3 — bot tự vẽ PNG theo từng thành viên.
    welcomeCardEnabled: v.optional(v.boolean()),
    welcomeCardBackground: v.optional(v.union(v.string(), v.null())),
    goodbyeCardEnabled: v.optional(v.boolean()),
    goodbyeCardBackground: v.optional(v.union(v.string(), v.null())),
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
    raidHuntEnabled: v.optional(v.boolean()),
    raidHuntBanSuspects: v.optional(v.boolean()),
    theme: v.optional(v.string()),
    verifyEnabled: v.optional(v.boolean()),
    verifyMethod: v.optional(v.union(v.literal("button"), v.literal("captcha"))),
    verifyChannelId: v.optional(v.union(v.string(), v.null())),
    unverifiedRoleId: v.optional(v.union(v.string(), v.null())),
    verifiedRoleId: v.optional(v.union(v.string(), v.null())),
    verifyWelcomeEnabled: v.optional(v.boolean()),
    verifyWelcomeTitle: v.optional(v.union(v.string(), v.null())),
    verifyWelcomeDescription: v.optional(v.union(v.string(), v.null())),
    verifyWelcomeColor: v.optional(v.union(v.string(), v.null())),
    verifySendPanel: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const user = await getUserByToken(ctx, args.token);
    const guild = await ctx.db
      .query("guilds")
      .withIndex("by_discordId", (q) => q.eq("discordId", args.guildId))
      .first();
    if (!guild || !canManageGuild(user, guild))
      throw new Error("Không có quyền quản lý server này");
    // settingsChangedAt = tín hiệu riêng cho bot biết "cấu hình vừa đổi" (xem
    // schema.ts). `updatedAt` không dùng được vì chính bot bump nó mỗi lượt sync.
    const patch: Record<string, unknown> = { updatedAt: Date.now(), settingsChangedAt: Date.now() };
    if (args.theme !== undefined) {
      // Five grayscale keys are the current dashboard contract. Legacy color keys
      // remain accepted during deployment skew; the UI maps them to Graphite.
      const THEME_KEYS = [
        "graphite",
        "slate",
        "steel",
        "mist",
        "fog",
        "pink",
        "rose",
        "orange",
        "amber",
        "green",
        "teal",
        "sky",
        "violet",
      ];
      if (!THEME_KEYS.includes(args.theme)) throw new Error("Chủ đề màu không hợp lệ");
      patch.theme = args.theme;
    }
    if (args.dailyReportEnabled !== undefined) patch.dailyReportEnabled = args.dailyReportEnabled;
    if (args.emergencyAlertEnabled !== undefined)
      patch.emergencyAlertEnabled = args.emergencyAlertEnabled;
    if (args.logPingEveryone !== undefined) patch.logPingEveryone = args.logPingEveryone;
    // Welcome/Goodbye: message cắt 1000 ký tự + nullable cho phép xoá nội dung.
    if (args.welcomeEnabled !== undefined) patch.welcomeEnabled = args.welcomeEnabled;
    if (args.welcomeChannelId !== undefined)
      patch.welcomeChannelId = args.welcomeChannelId ?? undefined;
    if (args.welcomeMessage !== undefined)
      patch.welcomeMessage = args.welcomeMessage ? args.welcomeMessage.slice(0, 1000) : undefined;
    if (args.welcomeUseEmbed !== undefined) patch.welcomeUseEmbed = args.welcomeUseEmbed;
    if (args.goodbyeEnabled !== undefined) patch.goodbyeEnabled = args.goodbyeEnabled;
    if (args.goodbyeChannelId !== undefined)
      patch.goodbyeChannelId = args.goodbyeChannelId ?? undefined;
    if (args.goodbyeMessage !== undefined)
      patch.goodbyeMessage = args.goodbyeMessage ? args.goodbyeMessage.slice(0, 1000) : undefined;
    if (args.goodbyeUseEmbed !== undefined) patch.goodbyeUseEmbed = args.goodbyeUseEmbed;
    // Welcome/Goodbye v2 — validate theo từng field (URL hợp lệ, màu #hex, trần 1000).
    if (args.welcomeRandom !== undefined)
      patch.welcomeRandom = args.welcomeRandom ? args.welcomeRandom.slice(0, 4000) : undefined;
    if (args.goodbyeRandom !== undefined)
      patch.goodbyeRandom = args.goodbyeRandom ? args.goodbyeRandom.slice(0, 4000) : undefined;
    if (args.welcomeDmEnabled !== undefined) patch.welcomeDmEnabled = args.welcomeDmEnabled;
    if (args.welcomeDmMessage !== undefined)
      patch.welcomeDmMessage = args.welcomeDmMessage
        ? args.welcomeDmMessage.slice(0, 1000)
        : undefined;
    if (args.welcomeEmbedTitle !== undefined)
      patch.welcomeEmbedTitle = args.welcomeEmbedTitle
        ? args.welcomeEmbedTitle.slice(0, 256)
        : undefined;
    if (args.goodbyeEmbedTitle !== undefined)
      patch.goodbyeEmbedTitle = args.goodbyeEmbedTitle
        ? args.goodbyeEmbedTitle.slice(0, 256)
        : undefined;
    for (const f of [
      "welcomeEmbedColor",
      "goodbyeEmbedColor",
      "welcomeEmbedImage",
      "goodbyeEmbedImage",
      "welcomeEmbedThumbnail",
      "goodbyeEmbedThumbnail",
    ] as const) {
      const val = args[f];
      if (val === undefined) continue;
      patch[f] = val ? cleanGreetingField(f, val) : undefined;
    }
    if (args.autoroleEnabled !== undefined) patch.autoroleEnabled = args.autoroleEnabled;
    if (args.autoroleRoleId !== undefined)
      patch.autoroleRoleId =
        args.autoroleRoleId && /^\d{15,20}$/.test(args.autoroleRoleId)
          ? args.autoroleRoleId
          : undefined;
    if (args.autoroleDelaySec !== undefined)
      patch.autoroleDelaySec = Math.max(0, Math.min(120, Math.floor(args.autoroleDelaySec || 0)));
    if (args.autoroleIncludeBots !== undefined)
      patch.autoroleIncludeBots = args.autoroleIncludeBots;
    // Thẻ ảnh v3: công tắc + nền (nền đi qua cùng validator URL như ảnh embed,
    // và cũng được dọn file cũ ở vòng lặp GREETING_IMAGE_SLOTS phía dưới).
    if (args.welcomeCardEnabled !== undefined) patch.welcomeCardEnabled = args.welcomeCardEnabled;
    if (args.goodbyeCardEnabled !== undefined) patch.goodbyeCardEnabled = args.goodbyeCardEnabled;
    if (args.welcomeCardBackground !== undefined)
      patch.welcomeCardBackground = args.welcomeCardBackground
        ? cleanGreetingField("welcomeCardBackground", args.welcomeCardBackground)
        : undefined;
    if (args.goodbyeCardBackground !== undefined)
      patch.goodbyeCardBackground = args.goodbyeCardBackground
        ? cleanGreetingField("goodbyeCardBackground", args.goodbyeCardBackground)
        : undefined;
    if (args.raidHuntEnabled !== undefined) patch.raidHuntEnabled = args.raidHuntEnabled;
    if (args.raidHuntBanSuspects !== undefined)
      patch.raidHuntBanSuspects = args.raidHuntBanSuspects;
    if (args.prefix !== undefined) {
      if (!/^[!^$#&%]{1,3}$/.test(args.prefix)) {
        throw new Error("Prefix phải là 1-3 ký tự đặc biệt (ví dụ: !, ^, !! )");
      }
      patch.prefix = args.prefix;
    }
    if (args.logChannelId !== undefined) patch.logChannelId = args.logChannelId || undefined;
    if (args.modLogChannelId !== undefined)
      patch.modLogChannelId = args.modLogChannelId || undefined;
    if (args.punishNoticeChannelId !== undefined) {
      patch.punishNoticeChannelId = args.punishNoticeChannelId || undefined;
    }
    if (args.punishNotice !== undefined) {
      const VALID = ["none", "action", "reason", "full"];
      const next: Record<string, unknown> = {};
      for (const k of ["ban", "timeout", "kick", "warn"] as const) {
        const level = args.punishNotice[k];
        if (!VALID.includes(level)) throw new Error(`Mức thông báo không hợp lệ (${k})`);
        next[k] = level;
      }
      patch.punishNotice = next;
    }
    if (args.whitelistUsers !== undefined) {
      const ids = args.whitelistUsers
        .map((id) => id.trim())
        .filter((id) => /^\d{15,20}$/.test(id))
        .slice(0, 100);
      patch.whitelistUsers = [...new Set(ids)];
    }
    if (args.whitelistRoles !== undefined) {
      const ids = args.whitelistRoles
        .map((id) => id.trim())
        .filter((id) => /^\d{15,20}$/.test(id))
        .slice(0, 100);
      patch.whitelistRoles = [...new Set(ids)];
    }
    if (args.modRoles !== undefined) {
      // Validate: chỉ Discord snowflake ID hợp lệ, tối đa 50 — mod/admin role là
      // dữ liệu quyết định AI được miễn trừ phạt chống nuke nên phải sạch.
      patch.modRoles = [
        ...new Set(
          args.modRoles
            .map((id) => id.trim())
            .filter((id) => /^\d{15,20}$/.test(id))
            .slice(0, 50),
        ),
      ];
    }
    if (args.adminRoles !== undefined) {
      patch.adminRoles = [
        ...new Set(
          args.adminRoles
            .map((id) => id.trim())
            .filter((id) => /^\d{15,20}$/.test(id))
            .slice(0, 50),
        ),
      ];
    }
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
    if (args.joinGateRequireAvatar !== undefined)
      patch.joinGateRequireAvatar = args.joinGateRequireAvatar;
    if (args.joinGateRequireFlag !== undefined)
      patch.joinGateRequireFlag = args.joinGateRequireFlag;
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
    if (args.verifyEnabled !== undefined) patch.verifyEnabled = args.verifyEnabled;
    if (args.verifyMethod !== undefined) patch.verifyMethod = args.verifyMethod;
    if (args.verifyChannelId !== undefined)
      patch.verifyChannelId = args.verifyChannelId || undefined;
    if (args.unverifiedRoleId !== undefined)
      patch.unverifiedRoleId = args.unverifiedRoleId || undefined;
    if (args.verifiedRoleId !== undefined) patch.verifiedRoleId = args.verifiedRoleId || undefined;
    if (args.verifyWelcomeEnabled !== undefined)
      patch.verifyWelcomeEnabled = args.verifyWelcomeEnabled;
    if (args.verifyWelcomeTitle !== undefined)
      patch.verifyWelcomeTitle = args.verifyWelcomeTitle || undefined;
    if (args.verifyWelcomeDescription !== undefined)
      patch.verifyWelcomeDescription = args.verifyWelcomeDescription || undefined;
    if (args.verifyWelcomeColor !== undefined)
      patch.verifyWelcomeColor = args.verifyWelcomeColor || undefined;
    if (args.verifySendPanel !== undefined) patch.verifySendPanel = args.verifySendPanel;
    // Yêu cầu gửi panel mới → xóa lỗi cũ (đây là lần thử lại của người dùng).
    if (args.verifySendPanel === true) {
      patch.verifyPanelError = undefined;
      patch.verifyPanelErrorAt = undefined;
    }
    // Dọn ảnh Convex của các ô ảnh vừa bị XOÁ (dashboard xoá chữ trong ô) — nếu
    // không, mỗi lần đổi ảnh để lại một file rác vĩnh viễn trong storage.
    for (const f of GREETING_IMAGE_SLOTS) {
      if (!(f in patch) || patch[f]) continue;
      // Ô đang bị xoá (f) phải loại khỏi phép kiểm tra — giá trị cũ của nó vẫn
      // còn trong guild lúc này (patch chạy sau) nên every() bao gồm f sẽ luôn
      // thấy file "còn dùng" → file rác vĩnh viễn (bug thật luồng 7e).
      const otherSlots = GREETING_IMAGE_SLOTS.filter((k) => k !== f);
      const oldId = storageIdFromUrl(guild[f]);
      if (oldId && otherSlots.every((k) => storageIdFromUrl(guild[k]) !== oldId)) {
        try {
          await ctx.storage.delete(oldId as Id<"_storage">);
        } catch {
          // file đã bị xoá / không còn — bỏ qua
        }
      }
    }
    await ctx.db.patch(guild._id, patch);
    return { ok: true };
  },
});

/** Trần ảnh thẻ chào: 8 MB — ảnh nặng hơn khiến Discord tải chậm mỗi lượt join/leave. */
const MAX_GREETING_IMAGE_BYTES = 8_000_000;

/**
 * Lấy id file storage từ URL Convex (`…/api/storage/<id>`) để dọn file cũ.
 * URL dán từ ngoài (imgur, cdn…) trả null — không phải file do mình tạo, không xoá.
 */
function storageIdFromUrl(url: string | undefined): string | null {
  if (!url) return null;
  const m = /\/api\/storage\/([A-Za-z0-9_-]+)$/.exec(url.trim());
  return m ? m[1] : null;
}

/** 4 ô ảnh của welcome/goodbye — dùng chung luật validate + dọn file. */
const GREETING_IMAGE_SLOTS = [
  "welcomeEmbedImage",
  "welcomeEmbedThumbnail",
  "goodbyeEmbedImage",
  "goodbyeEmbedThumbnail",
  // Nền của thẻ ảnh v3 — cùng luật validate URL + cùng luật dọn file.
  "welcomeCardBackground",
  "goodbyeCardBackground",
] as const;

/** URL upload ảnh thẻ chào (banner/thumbnail) — manager của server tự tải lên. */
export const generateGreetingImageUploadUrl = mutation({
  args: { token: v.string(), guildId: v.string() },
  handler: async (ctx, { token, guildId }) => {
    const user = await getUserByToken(ctx, token);
    const guild = await ctx.db
      .query("guilds")
      .withIndex("by_discordId", (q) => q.eq("discordId", guildId))
      .first();
    if (!guild || !canManageGuild(user, guild))
      throw new Error("Không có quyền quản lý server này");
    return await ctx.storage.generateUploadUrl();
  },
});

/**
 * Lưu ảnh vừa upload (từ dashboard) vào đúng ô banner/thumbnail của welcome
 * hoặc goodbye. Trả URL công khai để dashboard hiển thị preview NGAY; bot đọc
 * lại URL từ `getGuild` mỗi tick nên đổi ảnh là bot dùng ảnh mới trong ~1 tick.
 */
export const saveGreetingImage = mutation({
  args: {
    token: v.string(),
    guildId: v.string(),
    storageId: v.id("_storage"),
    slot: v.union(
      v.literal("welcomeEmbedImage"),
      v.literal("welcomeEmbedThumbnail"),
      v.literal("goodbyeEmbedImage"),
      v.literal("goodbyeEmbedThumbnail"),
      v.literal("welcomeCardBackground"),
      v.literal("goodbyeCardBackground"),
    ),
  },
  handler: async (ctx, { token, guildId, storageId, slot }) => {
    const user = await getUserByToken(ctx, token);
    const guild = await ctx.db
      .query("guilds")
      .withIndex("by_discordId", (q) => q.eq("discordId", guildId))
      .first();
    const dropUpload = async () => {
      try {
        await ctx.storage.delete(storageId);
      } catch {
        // chưa lưu được thì cũng không cần dọn nữa
      }
    };
    if (!guild || !canManageGuild(user, guild)) {
      await dropUpload();
      throw new Error("Không có quyền quản lý server này");
    }
    const meta = await ctx.storage.getMetadata(storageId);
    if (!meta) throw new Error("Ảnh không tồn tại hoặc đã bị xoá — hãy chọn lại ảnh");
    if (!String(meta.contentType ?? "").startsWith("image/")) {
      await dropUpload();
      throw new Error("Chỉ nhận file ảnh (PNG, JPG, GIF, WEBP).");
    }
    if (meta.size > MAX_GREETING_IMAGE_BYTES) {
      await dropUpload();
      throw new Error(
        `Ảnh quá lớn (tối đa ${MAX_GREETING_IMAGE_BYTES / 1_000_000} MB — ảnh này ${(meta.size / 1_000_000).toFixed(1)} MB).`,
      );
    }
    const url = await ctx.storage.getUrl(storageId);
    if (!url) throw new Error("Không lấy được URL ảnh vừa tải lên");
    // Dọn ảnh Convex cũ của CÙNG ô — chỉ khi ảnh đó không còn dùng ở ô khác
    // (người dùng có thể dùng lại một banner cho cả welcome lẫn goodbye).
    const oldId = storageIdFromUrl(guild[slot]);
    const otherSlots = GREETING_IMAGE_SLOTS.filter((k) => k !== slot);
    if (
      oldId &&
      oldId !== storageId &&
      otherSlots.every((k) => storageIdFromUrl(guild[k]) !== oldId)
    ) {
      try {
        await ctx.storage.delete(oldId as Id<"_storage">);
      } catch {
        // đã bị xoá — bỏ qua
      }
    }
    await ctx.db.patch(guild._id, {
      [slot]: url,
      updatedAt: Date.now(),
      // Tín hiệu cho bot áp dụng ngay (cùng cơ chế settingsChangedAt của updateSettings).
      settingsChangedAt: Date.now(),
    });
    return { ok: true, url };
  },
});

/**
 * Xoá ảnh khỏi một ô banner/thumbnail + dọn file storage.
 * Tách riêng khỏi updateSettings vì nút "Xoá ảnh" phải xoá ĐÚNG ô đó, không
 * ghi đè các field khác mà panel đang giữ trong state.
 */
export const removeGreetingImage = mutation({
  args: {
    token: v.string(),
    guildId: v.string(),
    slot: v.union(
      v.literal("welcomeEmbedImage"),
      v.literal("welcomeEmbedThumbnail"),
      v.literal("goodbyeEmbedImage"),
      v.literal("goodbyeEmbedThumbnail"),
      v.literal("welcomeCardBackground"),
      v.literal("goodbyeCardBackground"),
    ),
  },
  handler: async (ctx, { token, guildId, slot }) => {
    const user = await getUserByToken(ctx, token);
    const guild = await ctx.db
      .query("guilds")
      .withIndex("by_discordId", (q) => q.eq("discordId", guildId))
      .first();
    if (!guild || !canManageGuild(user, guild))
      throw new Error("Không có quyền quản lý server này");
    // Ô đang bị xoá phải được LOẠI khỏi phép kiểm tra "còn dùng ở chỗ khác" —
    // guild[slot] lúc này vẫn còn giữ URL cũ (patch xảy ra sau) nên every() bao
    // gồm ô đó sẽ luôn thấy file "còn dùng" → file rác không bao giờ được dọn
    // (bug thật bắt bởi luồng 7e của test-greeting-flow-e2e).
    const otherSlots = GREETING_IMAGE_SLOTS.filter((k) => k !== slot);
    const oldId = storageIdFromUrl(guild[slot]);
    if (oldId && otherSlots.every((k) => storageIdFromUrl(guild[k]) !== oldId)) {
      try {
        await ctx.storage.delete(oldId as Id<"_storage">);
      } catch {
        // bỏ qua
      }
    }
    await ctx.db.patch(guild._id, {
      [slot]: undefined,
      updatedAt: Date.now(),
      settingsChangedAt: Date.now(),
    });
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
    if (!guild || !canManageGuild(user, guild))
      throw new Error("Không có quyền quản lý server này");
    // settingsChangedAt: bot đọc lockdownEnabled/lockdownMinutes từ bundle cache
    // (TTL 30 phút) — thiếu tín hiệu thì bật/tắt "khóa kênh khi raid" phải chờ
    // tới 30 phút mới có tác dụng (cùng lớp bug welcome/goodbye 23/09).
    const patch: Record<string, unknown> = {
      updatedAt: Date.now(),
      settingsChangedAt: Date.now(),
    };
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
    // settingsChangedAt là BẮT BUỘC ở đây: cờ heatResetRequested được bot đọc
    // qua bundle cache, mà `hasPending` phía bot chỉ rút ngắn TTL khi bản cache
    // ĐÃ có cờ — lần yêu cầu đầu tiên (false → true) không được rút ngắn, nên
    // nút "Xóa nhiệt" sẽ đứng im tới 30 phút nếu thiếu tín hiệu này.
    await ctx.db.patch(guild._id, {
      heatResetRequested: true,
      heatResetUserId: userId ?? undefined,
      updatedAt: Date.now(),
      settingsChangedAt: Date.now(),
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
    if (!guild || !canManageGuild(user, guild))
      throw new Error("Không có quyền quản lý server này");
    // settingsChangedAt: bot chỉ thấy lockdownRequested qua bundle cache. Khi
    // đang khóa thì TTL tự ngắn (lockdownUntil tương lai), nhưng ca "khóa đã hết
    // hạn mà kênh chưa mở" lại rơi vào TTL 30 phút → nút Mở khóa đứng im.
    await ctx.db.patch(guild._id, {
      lockdownRequested: true,
      updatedAt: Date.now(),
      settingsChangedAt: Date.now(),
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
    if (!guild || !canManageGuild(user, guild))
      throw new Error("Không có quyền quản lý server này");
    await ctx.db.patch(guild._id, {
      antinukeEnabled: enabled,
      updatedAt: Date.now(),
      settingsChangedAt: Date.now(),
    });
    // BẬT TOÀN BỘ = bật luôn mọi module con (ngưỡng/cấu hình từng module giữ
    // nguyên). TẮT TOÀN BỘ = chỉ tắt tổng (antinukeEnabled=false) — giữ nguyên
    // enabled từng module, bật lại tổng là mọi module sẵn sàng ngay.
    if (enabled) {
      const mods = await ctx.db
        .query("antinukeModules")
        .withIndex("by_guildId", (q) => q.eq("guildId", guildId))
        .collect();
      const now = Date.now();
      for (const m of mods) {
        if (!m.enabled) await ctx.db.patch(m._id, { enabled: true, updatedAt: now });
      }
    }
    return { ok: true };
  },
});

/* ------------------------- Bot-side sync ------------------------- */

/** Query: find guilds where verifySendPanel is true (bot polls this). */
export const getVerifySendPanelGuilds = query({
  args: { botKey: v.optional(v.string()) },
  handler: async (ctx, { botKey }) => {
    await requireBotKeyStrict(ctx, botKey);
    // TỐI ƯU (audit Convex lần 2): chỉ duyệt guild ĐANG có bot qua index
    // by_botInGuild thay vì quét toàn bảng — fallback của batch tick, ít chạy.
    const guilds = await ctx.db
      .query("guilds")
      .withIndex("by_botInGuild", (q) => q.eq("botInGuild", true))
      .collect();
    return guilds
      .filter((g) => g.verifySendPanel === true && g.verifyEnabled && g.verifyChannelId)
      .map((g) => ({
        guildId: g.discordId,
        verifyChannelId: g.verifyChannelId!,
        unverifiedRoleId: g.unverifiedRoleId ?? null,
        verifiedRoleId: g.verifiedRoleId ?? null,
        verifyMethod: g.verifyMethod ?? "button",
      }));
  },
});

/**
 * Mutation: clear verifySendPanel flag after bot sends the panel.
 * Có `error` → lỗi gửi panel (bot không gửi được — web hiển thị lý do thay vì im lặng);
 * không `error` → gửi thành công, xóa lỗi cũ (nếu có).
 */
export const clearVerifySendPanel = mutation({
  args: {
    guildId: v.string(),
    error: v.optional(v.string()),
    /** Chìa khóa bot (botAuth) — chỉ bot có OWNER_SEED mới tính được. */
    botKey: v.optional(v.string()),
  },
  handler: async (ctx, { botKey, guildId, error }) => {
    await requireBotKeyStrict(ctx, botKey);
    const guild = await ctx.db
      .query("guilds")
      .withIndex("by_discordId", (q) => q.eq("discordId", guildId))
      .first();
    if (!guild) return;
    await ctx.db.patch(
      guild._id,
      error
        ? {
            verifySendPanel: false,
            verifyPanelError: String(error || "Lỗi không xác định").slice(0, 300),
            verifyPanelErrorAt: Date.now(),
            updatedAt: Date.now(),
          }
        : {
            verifySendPanel: false,
            verifyPanelError: undefined,
            verifyPanelErrorAt: undefined,
            updatedAt: Date.now(),
          },
    );
  },
});

/**
 * Bot lấy danh sách guild ID bot đang ở (1 query — dùng bởi scripts/audit-backups.cjs).
 * Bảo mật cao: botKey bắt buộc. Trả tối thiểu thông tin — không lộ gì thêm.
 */
export const botListGuildIds = query({
  args: { botKey: v.optional(v.string()) },
  handler: async (ctx, { botKey }) => {
    await requireBotKeyStrict(ctx, botKey);
    const all = await ctx.db
      .query("guilds")
      .withIndex("by_botInGuild", (q) => q.eq("botInGuild", true))
      .collect();
    return all.map((g) => ({ discordId: g.discordId, name: g.name }));
  },
});

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
    /**
     * Chỉ sweep (đánh dấu botInGuild=false) khi bot XÁC NHẬN danh sách guild đầy đủ.
     * Mặc định false: nếu cache guild bị thiếu (restart, gateway lấp dần, reconnect)
     * mà vẫn sweep thì hàng nghìn server bị đánh dấu "bot đã rời" và biến mất khỏi
     * dashboard — đã từng xảy ra với bot 2k+ server. Sweep thêm điều kiện guild vắng
     * mặt quá 10 phút (không phải lỗi thoáng qua).
     */
    trustedFullList: v.optional(v.boolean()),
    /**
     * TỐI ƯU USAGE: trạng thái toàn cục bot (heartbeat) gộp vào mutation này —
     * bot chỉ cần 1 call/phút thay vì 2 (botSyncGuilds + botHeartbeat riêng).
     */
    globalStatus: v.optional(
      v.object({
        guildCount: v.number(),
        memberCount: v.number(),
        version: v.string(),
        ownerName: v.optional(v.string()),
        ownerAvatarUrl: v.optional(v.string()),
        /** Sức khỏe AI (đợt 12) — đi nhờ vòng sync 60s, không tốn function call thêm. */
        aiHealth: v.optional(
          v.object({
            available: v.boolean(),
            providers: v.array(
              v.object({
                label: v.string(),
                model: v.optional(v.string()),
                inCooldown: v.boolean(),
              }),
            ),
            verdictCacheSize: v.number(),
            callsLastMinute: v.number(),
            inFlight: v.number(),
            verdictsLastHour: v.object({
              raid: v.number(),
              individual: v.number(),
              benign: v.number(),
              offline: v.number(),
              cache: v.number(),
            }),
            misfire: v.object({
              misfires7d: v.number(),
              pending: v.number(),
            }),
          }),
        ),
      }),
    ),
    /**
     * TỐI ƯU I/O: khi false (mặc định), guild row CHỈ được patch khi dữ liệu thật
     * sự khác bản đang lưu (name/icon/memberCount) — bỏ ghi lặp mỗi phút của
     * guild row ~90 fields (nguồn Database I/O lớn nhất, ~60 MB/ngày trước vá).
     * lastHeartbeat per-guild chỉ refresh theo chu kỳ refreshHeartbeat của bot.
     */
    refreshHeartbeat: v.optional(v.boolean()),
    /** Chìa khóa bot (botAuth) — chỉ bot có OWNER_SEED mới tính được. */
    botKey: v.optional(v.string()),
  },
  handler: async (ctx, { botKey, guilds, trustedFullList, globalStatus, refreshHeartbeat }) => {
    await requireBotKeyStrict(ctx, botKey);
    const now = Date.now();
    const present = new Set(guilds.map((g) => g.id));
    for (const g of guilds) {
      const existing = await ctx.db
        .query("guilds")
        .withIndex("by_discordId", (q) => q.eq("discordId", g.id))
        .first();
      if (existing) {
        // Patch CHỈ khi có khác biệt thật (hoặc đến chu kỳ refresh heartbeat) —
        // bỏ ghi lặp 1-2KB/guild/phút khi mọi thứ y nguyên.
        const changed =
          existing.name !== g.name ||
          existing.icon !== g.icon ||
          existing.memberCount !== g.memberCount ||
          !existing.botInGuild;
        if (changed || refreshHeartbeat === true) {
          await ctx.db.patch(existing._id, {
            name: g.name,
            icon: g.icon,
            memberCount: g.memberCount,
            botInGuild: true,
            lastHeartbeat: now,
            updatedAt: now,
          });
        }
      } else {
        const id = await ctx.db.insert("guilds", {
          discordId: g.id,
          name: g.name,
          icon: g.icon,
          memberCount: g.memberCount,
          prefix: "!",
          logChannelId: undefined,
          modLogChannelId: undefined,
          whitelistUsers: [],
          whitelistRoles: [],
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
          // Tự động backup mặc định mỗi 7 ngày (0 = tắt — chỉnh trong Backup server).
          backupAutoDays: 7,
          // Khôi phục role + kênh + tin nhắn + emoji/sticker bật theo mặc định (web có thể tắt).
          restoreRolesEnabled: true,
          restoreChannelsEnabled: true,
          restoreMessagesEnabled: true,
          restoreEmojisEnabled: true,
          // Raid Intel: bật săn nguồn cơn raid + tự ban nghi phạm theo mặc định.
          raidHuntEnabled: true,
          raidHuntBanSuspects: true,
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
            timeoutSeconds: m.module === "spam" || m.module === "attachment" ? 300 : 600,
            heat: m.heat,
            updatedAt: now,
          });
        }
        void id;
      }
    }
    // Guilds the bot left are no longer synced — CHỈ khi danh sách được xác nhận đầy
    // đủ (trustedFullList === true) và guild vắng mặt quá 10 phút.
    // TỐI ƯU (audit Convex): sweep chỉ chạy mỗi 10 phút (refreshHeartbeat đã là
    // chu kỳ 5 sync ≈ 10 phút — đi nhờ cùng cờ) thay vì mỗi phút; các guild rời
    // đã có sự kiện guildDelete xử lý real-time (botGuildGone) nên sweep này chỉ
    // là lưới an toàn cho trường hợp event sót. Index by_botInGuild thay collect()
    // toàn bảng (trước đây đọc ~90 fields × mọi guild mỗi phút).
    if (trustedFullList === true && refreshHeartbeat === true) {
      const inGuild = await ctx.db
        .query("guilds")
        .withIndex("by_botInGuild", (q) => q.eq("botInGuild", true))
        .collect();
      for (const guild of inGuild) {
        if (present.has(guild.discordId)) continue;
        if (now - (guild.lastHeartbeat ?? 0) < 10 * 60_000) continue;
        await ctx.db.patch(guild._id, { botInGuild: false, updatedAt: now });
      }
    }
    // Heartbeat toàn cục gộp chung (TỐI ƯU USAGE): cùng logic guilds:botHeartbeat
    // nhưng không tốn thêm 1 function call/phút riêng biệt nữa.
    if (globalStatus) {
      const status = await ctx.db
        .query("botStatus")
        .withIndex("by_kind", (q) => q.eq("kind", "status"))
        .first();
      const statusPatch: Record<string, unknown> = {
        online: true,
        guildCount: globalStatus.guildCount,
        memberCount: globalStatus.memberCount,
        lastHeartbeat: now,
        version: globalStatus.version,
      };
      if (globalStatus.ownerName !== undefined)
        statusPatch.ownerName = globalStatus.ownerName.slice(0, 120);
      if (globalStatus.ownerAvatarUrl !== undefined)
        statusPatch.ownerAvatarUrl = globalStatus.ownerAvatarUrl.slice(0, 2000);
      // Sức khỏe AI (đợt 12): tổng hợp aiStats() — chỉ owner đọc được qua
      // status:getAiHealth (guard isOwner). reportedAt ghi phía server để bot
      // không thể giả mạo thời điểm (dù bot đáng tin theo botKey).
      if (globalStatus.aiHealth !== undefined)
        statusPatch.aiHealth = { ...globalStatus.aiHealth, reportedAt: now };
      if (status) {
        await ctx.db.patch(status._id, statusPatch);
      } else {
        await ctx.db.insert("botStatus", {
          kind: "status",
          online: true,
          guildCount: globalStatus.guildCount,
          memberCount: globalStatus.memberCount,
          lastHeartbeat: now,
          startedAt: now,
          version: globalStatus.version,
          ownerName: globalStatus.ownerName?.slice(0, 120),
          ownerAvatarUrl: globalStatus.ownerAvatarUrl?.slice(0, 2000),
        });
      }
    }
    return { ok: true };
  },
});

/** Bot bị kick khỏi guild → đánh dấu đúng guild đó (sự kiện guildDelete, không sweep toàn bộ). */
export const botGuildGone = mutation({
  args: {
    guildId: v.string(),
    /** Chìa khóa bot (botAuth) — chỉ bot có OWNER_SEED mới tính được. */
    botKey: v.optional(v.string()),
  },
  handler: async (ctx, { botKey, guildId }) => {
    await requireBotKeyStrict(ctx, botKey);
    const guild = await ctx.db
      .query("guilds")
      .withIndex("by_discordId", (q) => q.eq("discordId", guildId))
      .first();
    if (!guild) return { ok: true };
    await ctx.db.patch(guild._id, { botInGuild: false, updatedAt: Date.now() });
    return { ok: true };
  },
});

/** Chẩn đoán sức khỏe sync: số guild đang hiển thị / đã ẩn / heartbeat cũ (không lộ id).
 *  Chỉ bot (botKey) hoặc chủ bot đăng nhập web được gọi — trước đây quét toàn bộ
 *  bảng guilds mở công khai, tốn hạn mức mỗi lần gọi. */
export const botGuildStats = query({
  args: {
    botKey: v.optional(v.string()),
    token: v.optional(v.string()),
  },
  handler: async (ctx, { botKey, token }) => {
    if (botKey) {
      await requireBotKeyStrict(ctx, botKey);
    } else if (token) {
      const user = await getUserByToken(ctx, token);
      if (!user) return null;
      const status = await getBotStatus(ctx);
      if (!isBotOwnerUser(user, status)) return null;
    } else {
      return null;
    }
    const all = await ctx.db.query("guilds").collect();
    const now = Date.now();
    let inGuild = 0;
    let gone = 0;
    let staleInGuild = 0;
    let oldestHeartbeat = now;
    for (const g of all) {
      if (g.botInGuild) {
        inGuild++;
        if (now - (g.lastHeartbeat ?? 0) > 15 * 60_000) staleInGuild++;
        oldestHeartbeat = Math.min(oldestHeartbeat, g.lastHeartbeat ?? now);
      } else {
        gone++;
      }
    }
    return {
      total: all.length,
      inGuild,
      gone,
      staleInGuild,
      now,
      oldestHeartbeat,
    };
  },
});

export const botHeartbeat = mutation({
  args: {
    guildCount: v.number(),
    memberCount: v.number(),
    version: v.string(),
    ownerName: v.optional(v.string()),
    ownerAvatarUrl: v.optional(v.string()),
    /** Chìa khóa bot (botAuth) — chỉ bot có OWNER_SEED mới tính được. */
    botKey: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    await requireBotKeyStrict(ctx, args.botKey);
    const now = Date.now();
    const existing = await ctx.db
      .query("botStatus")
      .withIndex("by_kind", (q) => q.eq("kind", "status"))
      .first();
    const patch: Record<string, unknown> = {
      online: true,
      guildCount: args.guildCount,
      memberCount: args.memberCount,
      lastHeartbeat: now,
      version: args.version,
    };
    if (args.ownerName !== undefined) patch.ownerName = args.ownerName.slice(0, 120);
    if (args.ownerAvatarUrl !== undefined)
      patch.ownerAvatarUrl = args.ownerAvatarUrl.slice(0, 2000);
    if (existing) {
      await ctx.db.patch(existing._id, patch);
    } else {
      await ctx.db.insert("botStatus", {
        kind: "status",
        online: true,
        guildCount: args.guildCount,
        memberCount: args.memberCount,
        lastHeartbeat: now,
        startedAt: now,
        version: args.version,
        ownerName: args.ownerName?.slice(0, 120),
        ownerAvatarUrl: args.ownerAvatarUrl?.slice(0, 2000),
      });
    }
    return { ok: true };
  },
});

export const syncChannels = mutation({
  args: {
    guildId: v.string(),
    channels: v.array(v.object({ channelId: v.string(), name: v.string(), type: v.number() })),
    /** Chìa khóa bot (botAuth) — chỉ bot có OWNER_SEED mới tính được. */
    botKey: v.optional(v.string()),
  },
  handler: async (ctx, { botKey, guildId, channels }) => {
    await requireBotKeyStrict(ctx, botKey);
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
    /** Chìa khóa bot (botAuth) — chỉ bot có OWNER_SEED mới tính được. */
    botKey: v.optional(v.string()),
  },
  handler: async (ctx, { botKey, guildId, roles }) => {
    await requireBotKeyStrict(ctx, botKey);
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

/**
 * Emoji tuỳ chỉnh của server — chỉ để dashboard hiển thị picker chèn emoji.
 * Bot gửi mã `<:ten:id>` chứ không gửi ảnh, nên bảng này là dữ liệu hiển thị:
 * emoji bị xoá sau đó không làm hỏng tin nhắn đã lưu.
 */
export const syncEmojis = mutation({
  args: {
    guildId: v.string(),
    emojis: v.array(v.object({ emojiId: v.string(), name: v.string(), animated: v.boolean() })),
    /** Chìa khóa bot (botAuth) — chỉ bot có OWNER_SEED mới tính được. */
    botKey: v.optional(v.string()),
  },
  handler: async (ctx, { botKey, guildId, emojis }) => {
    await requireBotKeyStrict(ctx, botKey);
    // Chỉ ghi khi danh sách thật sự đổi — tránh xoá/ghi lại mỗi vòng sync
    // (bot sync mỗi ~5 phút; ghi vô điều kiện làm dashboard re-render liên tục).
    const old = await ctx.db
      .query("guildEmojis")
      .withIndex("by_guildId", (q) => q.eq("guildId", guildId))
      .collect();
    const cur = old
      .map((e) => `${e.emojiId}:${e.name}:${e.animated ? 1 : 0}`)
      .sort()
      .join(",");
    const next = emojis
      .map((e) => `${e.emojiId}:${e.name}:${e.animated ? 1 : 0}`)
      .sort()
      .join(",");
    if (cur === next && old.length > 0) return { ok: true, unchanged: true };
    for (const e of old) await ctx.db.delete(e._id);
    for (const e of emojis) {
      await ctx.db.insert("guildEmojis", {
        guildId,
        emojiId: e.emojiId,
        name: e.name,
        animated: e.animated,
      });
    }
    return { ok: true, unchanged: false };
  },
});
