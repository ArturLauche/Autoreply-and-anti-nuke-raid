const { AuditLogEvent, PermissionFlagsBits, Colors } = require("discord.js");
const { logEmbed, sendLog } = require("../util");
const { isLocked, markLocked, lockGuild, unlockGuild } = require("../lockdown");

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
};

module.exports = function createAntiNuke(client, store) {
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

  async function punish(guild, member, moduleCfg, reason) {
    const punishType = moduleCfg.punish || "warn";
    if (punishType === "timeout") {
      const seconds = Math.max(1, Math.min(86400, moduleCfg.timeoutSeconds || 300));
      try {
        await member.timeout(seconds * 1000, reason);
        return `đã tạm khóa ${Math.round(seconds / 60)} phút`;
      } catch {
        return "không thể tạm khóa (thiếu quyền)";
      }
    }
    if (punishType === "warn") {
      try {
        await member.send(`⚠️ **Cảnh báo từ Protogon**\n${reason}\n\nĐây là cảnh báo tự động từ hệ thống chống nuke. Vui lòng dừng hành vi này.`);
        return "đã cảnh báo qua DM";
      } catch {
        return "đã cố cảnh báo (DM đóng)";
      }
    }
    try {
      if (punishType === "kick") {
        await member.kick(reason);
        return "đã kick";
      }
      await member.ban({ reason, deleteMessageSeconds: 0 });
      return "đã ban";
    } catch {
      return "không thể xử lý (thiếu quyền)";
    }
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
        action = await punish(guild, member, moduleCfg, reason);
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
        { name: "Xử lý", value: action, inline: true },
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
      const action = await punish(guild, m, moduleCfg, reason);
      results.push(`<@${j.id}>: ${action}`);
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
    const action = await punish(message.guild, member, moduleCfg, reason);
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
        { name: "Xử lý", value: action, inline: true },
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
    }, 20_000);
  }

  return { attach };
};

module.exports.MODULE_LABELS = MODULE_LABELS;
