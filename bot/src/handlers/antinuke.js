const { AuditLogEvent, PermissionFlagsBits, Colors } = require("discord.js");
const { logEmbed, sendLog } = require("../util");
const { isLocked, markLocked, lockGuild, unlockGuild } = require("../lockdown");
const {
  heatSettings,
  punishMember,
  choosePunish,
  heatSummary,
} = require("../heat");

const MODULE_LABELS = {
  massBan: "Ban hàng loạt",
  massKick: "Kick hàng loạt",
  massJoin: "Raid thành viên",
  massChannelCreate: "Tạo kênh hàng loạt",
  massChannelDelete: "Xóa kênh hàng loạt",
  massRoleCreate: "Tạo role hàng loạt",
  massRoleDelete: "Xóa role hàng loạt",
  massMessageDelete: "Xóa tin hàng loạt",
  spam: "Chống spam tin nhắn",
  badword: "Từ ngữ xấu",
  attachment: "Spam ảnh/file đính kèm",
  invite: "Link mời Discord",
};

module.exports = function createAntiNuke(client, store, heat) {
  /** Persist a punished event for the daily report. Fire-and-forget. */
  async function recordEvent(guildId, payload) {
    try {
      await store.client.mutation("bot_writes:botRecordAntinukeEvent", { guildId, ...payload });
    } catch (err) {
      console.error("[antinuke:record]", err.message);
    }
  }
  const buckets = new Map(); // `${guildId}:${module}` -> [timestamps]
  const joiners = new Map(); // guildId -> [{id, ts}]
  const spamBuckets = new Map(); // `${guildId}:${userId}` -> [timestamps]

  function record(guildId, module, cfg) {
    const key = `${guildId}:${module}`;
    const arr = buckets.get(key) ?? [];
    const now = Date.now();
    arr.push(now);
    const cutoff = now - cfg.windowSeconds * 1000;
    const pruned = arr.filter((t) => t >= cutoff);
    buckets.set(key, pruned);
    return pruned.length;
  }

  function isExempt(member, moduleCfg, guildConfig) {
    if (!member) return false;
    if (member.id === member.guild.ownerId) return true;
    if (member.permissions.has(PermissionFlagsBits.Administrator)) return true;
    if ((guildConfig?.adminRoles || []).some((id) => member.roles.cache.has(id))) return true;
    if ((guildConfig?.modRoles || []).some((id) => member.roles.cache.has(id))) return true;
    if ((moduleCfg?.whitelistRoles || []).some((id) => member.roles.cache.has(id))) return true;
    return false;
  }

  async function auditExecutor(guild, eventType, targetId) {
    try {
      const fetched = await guild.fetchAuditLogs({ type: eventType, limit: 5 });
      if (targetId) {
        const entry = fetched.entries.find((e) => e.target?.id === targetId);
        if (entry) return entry.executor;
      }
      const first = fetched.entries.first();
      return first ? first.executor : null;
    } catch {
      return null;
    }
  }

  /**
   * Phạt một thành viên, tự tăng cấp hình phạt nếu nhiệt độ vượt ngưỡng.
   * Trả về mô tả hành động.
   */
  async function punishWithHeat(guild, member, moduleCfg, reason) {
    const s = heatSettings(configOf(guild.id));
    const heatRes = await heat.add(
      guild.id,
      member.id,
      member.user?.username,
      moduleCfg.heat ?? 10,
      s,
    );
    const chosen = choosePunish(moduleCfg.punish || "warn", heatRes);
    const action = await punishMember(guild, member, chosen, reason, moduleCfg.timeoutSeconds);
    return { action: action + heatSummary(heatRes), chosen, heatRes };
  }

  // Lưu config đã đọc gần nhất để punishWithHeat tái sử dụng (tránh đọc lại DB).
  const lastConfigs = new Map(); // guildId -> config

  function configOf(guildId) {
    return lastConfigs.get(guildId) ?? {};
  }

  /** Auto-lock channels when a raid is confirmed and lockdown is enabled. */
  async function maybeLockdown(guild, config) {
    if (!config.lockdownEnabled) return;
    if (isLocked(guild.id)) return;
    await lockGuild(client, guild, config, store);
  }

  async function handleAttributeEvent({ guild, module, eventType, targetId, describeTarget }) {
    if (!guild || guild.available === false) return;
    const config = await store.getConfig(guild.id);
    if (!config || !config.antinukeEnabled) return;
    lastConfigs.set(guild.id, config);
    const moduleCfg = config.modules.find((m) => m.module === module);
    if (!moduleCfg || !moduleCfg.enabled) return;

    const executor = await auditExecutor(guild, eventType, targetId);
    if (executor && (executor.id === client.user.id || isExempt(executor, moduleCfg, config))) {
      return; // whitelisted / self — fully ignore
    }

    const count = record(guild.id, module, moduleCfg);
    if (executor && count < moduleCfg.threshold) return;
    if (!executor) return; // can't attribute, can't punish — stay quiet

    let action = "đã ghi nhận";
    try {
      const member = await guild.members.fetch(executor.id).catch(() => null);
      const reason = `[Protogon AntiNuke] ${MODULE_LABELS[module]}: ${count} lượt trong ${moduleCfg.windowSeconds}s (ngưỡng ${moduleCfg.threshold})`;
      if (member) {
        const res = await punishWithHeat(guild, member, moduleCfg, reason);
        action = res.action;
      } else if (moduleCfg.punish === "ban") {
        try {
          await guild.members.ban(executor.id, { reason });
          action = "đã ban";
        } catch {
          action = "không thể ban";
        }
      }
      await maybeLockdown(guild, config);
    } catch {
      action = "không thể xử lý";
    }

    await recordEvent(guild.id, {
      module,
      executorId: executor.id,
      executorName: executor.username ?? undefined,
      action,
      count,
      windowSeconds: moduleCfg.windowSeconds,
      threshold: moduleCfg.threshold,
      punish: moduleCfg.punish,
    });

    const embed = logEmbed({
      title: `🚨 Cảnh báo: ${MODULE_LABELS[module]}`,
      description: `Đã phát hiện **${count} lượt** trong **${moduleCfg.windowSeconds} giây** (ngưỡng ${moduleCfg.threshold}).`,
      color: Colors.Red,
      fields: [
        { name: "Thủ phạm", value: `<@${executor.id}>`, inline: true },
        { name: "Xử lý", value: action.slice(0, 1000), inline: true },
        { name: "Module", value: `\`${module}\``, inline: true },
        ...(describeTarget ? [{ name: "Đối tượng", value: describeTarget, inline: false }] : []),
      ],
      footer: "Protogon Anti Nuke",
    });
    await sendLog(guild, config, embed);
  }

  async function handleRaidJoin(member) {
    const guild = member.guild;
    const config = await store.getConfig(guild.id);
    if (!config || !config.antinukeEnabled) return;
    lastConfigs.set(guild.id, config);
    const moduleCfg = config.modules.find((m) => m.module === "massJoin");
    if (!moduleCfg || !moduleCfg.enabled) return;

    const arr = joiners.get(guild.id) ?? [];
    arr.push({ id: member.id, ts: Date.now() });
    const cutoff = Date.now() - moduleCfg.windowSeconds * 1000;
    const fresh = arr.filter((j) => j.ts >= cutoff);
    joiners.set(guild.id, fresh);
    if (fresh.length < moduleCfg.threshold) return;

    const reason = `[Protogon AntiNuke] Raid thành viên: ${fresh.length} người tham gia trong ${moduleCfg.windowSeconds}s`;
    const results = [];
    for (const j of fresh) {
      const m = await guild.members.fetch(j.id).catch(() => null);
      if (!m || isExempt(m, moduleCfg, config)) continue;
      const res = await punishWithHeat(guild, m, moduleCfg, reason);
      results.push(`<@${j.id}>: ${res.action}`);
    }
    await maybeLockdown(guild, config);

    await recordEvent(guild.id, {
      module: "massJoin",
      executorId: undefined,
      executorName: undefined,
      action:
        results.length > 0
          ? `xử lý ${results.length} tài khoản (${moduleCfg.punish})`
          : "không có tài khoản để xử lý",
      count: fresh.length,
      windowSeconds: moduleCfg.windowSeconds,
      threshold: moduleCfg.threshold,
      punish: moduleCfg.punish,
    });

    const embed = logEmbed({
      title: `🚨 Raid thành viên!`,
      description: `**${fresh.length}** thành viên tham gia trong **${moduleCfg.windowSeconds} giây** (ngưỡng ${moduleCfg.threshold}). Đã xử lý ${results.length} tài khoản.`,
      color: Colors.Red,
      fields:
        results.length > 0
          ? [{ name: "Kết quả xử lý", value: results.slice(0, 10).join("\n").slice(0, 1000) }]
          : [],
      footer: "Protogon Anti Nuke",
    });
    await sendLog(guild, config, embed);
  }

  async function handleSpam(message) {
    if (!message.guild) return;
    if (message.author.bot) return;
    if (message.channel.isDMBased?.()) return;
    const config = await store.getConfig(message.guild.id);
    if (!config || !config.antinukeEnabled) return;
    lastConfigs.set(message.guild.id, config);
    const moduleCfg = config.modules.find((m) => m.module === "spam");
    if (!moduleCfg || !moduleCfg.enabled) return;
    const member = message.member;
    if (!member || isExempt(member, moduleCfg, config)) return;

    const key = `${message.guild.id}:${message.author.id}`;
    const now = Date.now();
    const arr = spamBuckets.get(key) ?? [];
    arr.push(now);
    const cutoff = now - moduleCfg.windowSeconds * 1000;
    const fresh = arr.filter((t) => t >= cutoff);
    spamBuckets.set(key, fresh);
    if (fresh.length < moduleCfg.threshold) return;

    spamBuckets.delete(key); // reset after punishing
    const reason = `[Protogon AntiNuke] Spam: ${fresh.length} tin nhắn trong ${moduleCfg.windowSeconds}s`;
    const res = await punishWithHeat(message.guild, member, moduleCfg, reason);
    const action = res.action;
    await maybeLockdown(message.guild, config);

    await recordEvent(message.guild.id, {
      module: "spam",
      executorId: message.author.id,
      executorName: message.author.username,
      action,
      count: fresh.length,
      windowSeconds: moduleCfg.windowSeconds,
      threshold: moduleCfg.threshold,
      punish: moduleCfg.punish,
    });

    const embed = logEmbed({
      title: "🚨 Cảnh báo: Chống spam tin nhắn",
      description: `<@${message.author.id}> đã gửi **${fresh.length} tin nhắn** trong **${moduleCfg.windowSeconds} giây** (ngưỡng ${moduleCfg.threshold}).`,
      color: Colors.Red,
      fields: [
        { name: "Thủ phạm", value: `<@${message.author.id}>`, inline: true },
        { name: "Xử lý", value: action.slice(0, 1000), inline: true },
        { name: "Module", value: "`spam`", inline: true },
      ],
      footer: "Protogon Anti Nuke",
    });
    await sendLog(message.guild, config, embed);
  }

  /** Periodically unlock guilds whose lockdown expired or was requested. */
  async function tickUnlocks() {
    const now = Date.now();
    for (const guild of client.guilds.cache.values()) {
      try {
        const config = await store.getConfig(guild.id);
        if (!config) continue;
        if (!isLocked(guild.id)) {
          // Resume after restart: the server may still be locked from before.
          if (config.lockdownUntil && config.lockdownUntil > now) {
            markLocked(guild.id);
          }
          continue;
        }
        if (config.lockdownRequested || (config.lockdownUntil && config.lockdownUntil <= now)) {
          await unlockGuild(client, guild, config, store);
        }
      } catch (err) {
        console.error(`[antinuke:unlock] ${guild.id}:`, err.message);
      }
    }
  }

  /**
   * Dashboard bấm "Xóa nhiệt" → đặt cờ heatResetRequested. Bot xóa nhiệt trong
   * bộ nhớ (và bỏ cảnh báo DM đã gửi) rồi xóa cờ để không reset lại lần sau.
   */
  async function tickHeatResets() {
    for (const guild of client.guilds.cache.values()) {
      try {
        const config = await store.getConfig(guild.id);
        if (!config || !config.heatResetRequested) continue;
        heat.resetGuild(guild.id, config.heatResetUserId || undefined);
        await store.client.mutation("bot_writes:botClearHeatReset", { guildId: guild.id });
        console.log(`[heat:reset] ${guild.id} đã xóa nhiệt${config.heatResetUserId ? ` của ${config.heatResetUserId}` : " toàn bộ"}`);
      } catch (err) {
        console.error(`[heat:reset] ${guild.id}:`, err.message);
      }
    }
  }

  async function handleMessageBulk(messages) {
    const guild = messages.first()?.guild;
    await handleAttributeEvent({
      guild,
      module: "massMessageDelete",
      eventType: AuditLogEvent.MessageBulkDelete,
      targetId: null,
      describeTarget: `Xóa ${messages.size} tin nhắn trong kênh <#${messages.first()?.channelId ?? "?"}>`,
    });
  }

  function attach() {
    client.on("guildBanAdd", async (ban) => {
      await handleAttributeEvent({
        guild: ban.guild,
        module: "massBan",
        eventType: AuditLogEvent.MemberBanAdd,
        targetId: ban.user?.id,
        describeTarget: `<@${ban.user?.id}>`,
      }).catch((e) => console.error("[antinuke:ban]", e.message));
    });

    client.on("guildMemberRemove", async (member) => {
      // Only treat as a kick when the audit log shows a kick for this member.
      const executor = await auditExecutor(member.guild, AuditLogEvent.MemberKick, member.id).catch(() => null);
      if (!executor) return;
      await handleAttributeEvent({
        guild: member.guild,
        module: "massKick",
        eventType: AuditLogEvent.MemberKick,
        targetId: member.id,
        describeTarget: `<@${member.id}>`,
      }).catch((e) => console.error("[antinuke:kick]", e.message));
    });

    client.on("channelCreate", (channel) => {
      void handleAttributeEvent({
        guild: channel.guild,
        module: "massChannelCreate",
        eventType: AuditLogEvent.ChannelCreate,
        targetId: channel.id,
        describeTarget: `#${channel.name}`,
      }).catch((e) => console.error("[antinuke:channelCreate]", e.message));
    });

    client.on("channelDelete", (channel) => {
      void handleAttributeEvent({
        guild: channel.guild,
        module: "massChannelDelete",
        eventType: AuditLogEvent.ChannelDelete,
        targetId: channel.id,
        describeTarget: `#${channel.name}`,
      }).catch((e) => console.error("[antinuke:channelDelete]", e.message));
    });

    client.on("roleCreate", (role) => {
      void handleAttributeEvent({
        guild: role.guild,
        module: "massRoleCreate",
        eventType: AuditLogEvent.RoleCreate,
        targetId: role.id,
        describeTarget: `<@&${role.id}>`,
      }).catch((e) => console.error("[antinuke:roleCreate]", e.message));
    });

    client.on("roleDelete", (role) => {
      void handleAttributeEvent({
        guild: role.guild,
        module: "massRoleDelete",
        eventType: AuditLogEvent.RoleDelete,
        targetId: role.id,
        describeTarget: role.name,
      }).catch((e) => console.error("[antinuke:roleDelete]", e.message));
    });

    client.on("messageDeleteBulk", (messages) => {
      void handleMessageBulk(messages).catch((e) => console.error("[antinuke:bulk]", e.message));
    });

    client.on("guildMemberAdd", (member) => {
      void handleRaidJoin(member).catch((e) => console.error("[antinuke:join]", e.message));
    });

    client.on("messageCreate", (message) => {
      void handleSpam(message).catch((e) => console.error("[antinuke:spam]", e.message));
    });

    setInterval(() => {
      void tickUnlocks().catch((e) => console.error("[antinuke:tick]", e.message));
      void tickHeatResets().catch((e) => console.error("[heat:resetTick]", e.message));
    }, 20_000);
  }

  return { attach };
};

module.exports.MODULE_LABELS = MODULE_LABELS;
