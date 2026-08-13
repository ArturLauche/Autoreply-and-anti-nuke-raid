const { AuditLogEvent, PermissionFlagsBits, Colors } = require("discord.js");
const { logEmbed, sendLog, sendAutoModLog } = require("../util");
const { isLocked, markLocked, lockGuild, unlockGuild } = require("../lockdown");
const {
  heatSettings,
  punishMember,
  choosePunish,
  heatSummary,
} = require("../heat");
const { actionsOf, memberPunishOf, cleanupMessages } = require("../moduleActions");

const MODULE_LABELS = {
  massBan: "Ban hàng loạt",
  massKick: "Kick hàng loạt",
  massJoin: "Raid thành viên",
  massChannelCreate: "Tạo kênh hàng loạt",
  massChannelDelete: "Xóa kênh hàng loạt",
  massRoleCreate: "Tạo role hàng loạt",
  massRoleDelete: "Xóa role hàng loạt",
  massMessageDelete: "Xóa tin hàng loạt",
  massWebhookCreate: "Tạo webhook hàng loạt",
  massThreadCreate: "Tạo thread hàng loạt",
  spam: "Chống spam tin nhắn",
  massMessage: "Spam tin dài / lặp nội dung",
  blankNoise: "Tin giả blank gây nhiễu",
  badword: "Từ ngữ xấu",
  attachment: "Spam ảnh/file đính kèm",
  invite: "Link mời Discord",
  malware: "Link độc hại & file nguy hiểm",
};

// Module nuke/raid: phạt trực tiếp, KHÔNG cộng nhiệt (chỉ có hình phạt gốc).
const NUKE_MODULES = new Set([
  "massBan",
  "massKick",
  "massJoin",
  "massChannelCreate",
  "massChannelDelete",
  "massRoleCreate",
  "massRoleDelete",
  "massMessageDelete",
  "massWebhookCreate",
  "massThreadCreate",
]);

// Tin nhắn "giả blank": chỉ gồm khoảng trắng / ký tự ẩn (zero-width) / xuống dòng.
const BLANK_ONLY_RE = /^[\s\u200b-\u200d\u2060\ufeff\u00a0]+$/;
// Ký tự ẩn thường dùng để gây nhiễu.
const ZERO_WIDTH_RE = /[\u200b-\u200d\u2060\ufeff]/g;
// Ngưỡng độ dài coi là "tin dài cực dài" (Discord giới hạn 2000 ký tự).
const LONG_MSG_LEN = 300;
// Kích thước tối đa của các bucket trong bộ nhớ (chống rò rỉ RAM).
const BUCKET_MAX = 200;

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
  const patternBuckets = new Map(); // `${guildId}:${userId}:${pattern}` -> [timestamps]
  const recentMessages = new Map(); // `${guildId}:${userId}` -> [{content, ts}] (mẫu cho AI)
  const lastConfigs = new Map(); // guildId -> config (đã đọc gần nhất)

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
    // Whitelist toàn cục: role/người dùng được miễn trừ khỏi mọi module nuke/raid/moderation.
    if ((guildConfig?.whitelistRoles || []).some((id) => member.roles.cache.has(id))) return true;
    if ((guildConfig?.whitelistUsers || []).includes(member.id)) return true;
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

  /** Dọn bộ nhớ định kỳ: xóa entry cũ của guild đã rời / vượt cửa sổ. */
  function sweepMemory() {
    const now = Date.now();
    const live = new Set(client.guilds.cache.keys());
    for (const [key] of buckets) {
      const guildId = key.split(":")[0];
      if (!live.has(guildId)) buckets.delete(key);
    }
    // Chống rò rỉ RAM: ngoài việc xóa guild đã rời, còn loại luôn entry cũ
    // quá 10 phút của guild ĐANG hoạt động (trước đây cứ tích lại mãi).
    const stale = now - 600_000;
    for (const [guildId, arr] of joiners) {
      if (!live.has(guildId)) {
        joiners.delete(guildId);
        continue;
      }
      const fresh = arr.filter((j) => j.ts >= stale);
      if (fresh.length === 0) joiners.delete(guildId);
      else joiners.set(guildId, fresh);
    }
    for (const [key, arr] of spamBuckets) {
      const guildId = key.split(":")[0];
      if (!live.has(guildId)) {
        spamBuckets.delete(key);
        continue;
      }
      const fresh = arr.filter((t) => t >= stale);
      if (fresh.length === 0) spamBuckets.delete(key);
      else spamBuckets.set(key, fresh);
    }
    for (const [key, arr] of patternBuckets) {
      const guildId = key.split(":")[0];
      if (!live.has(guildId)) {
        patternBuckets.delete(key);
        continue;
      }
      const fresh = arr.filter((t) => t >= stale);
      if (fresh.length === 0) patternBuckets.delete(key);
      else patternBuckets.set(key, fresh);
    }
    for (const [key, arr] of recentMessages) {
      const guildId = key.split(":")[0];
      if (!live.has(guildId)) {
        recentMessages.delete(key);
        continue;
      }
      const fresh = arr.filter((m) => now - m.ts < 60_000);
      if (fresh.length === 0) recentMessages.delete(key);
      else recentMessages.set(key, fresh);
    }
    for (const [guildId] of lastConfigs) {
      if (!live.has(guildId)) lastConfigs.delete(guildId);
    }
    if (buckets.size > BUCKET_MAX) {
      // Giữ lại 200 key gần nhất (chống phình vô hạn)
      const keys = [...buckets.keys()].slice(0, buckets.size - BUCKET_MAX);
      for (const k of keys) buckets.delete(k);
    }
  }

  /** Gọi AI phân loại sự kiện raid vs cá nhân. Trả về null khi AI không có. */
  async function aiClassify(guild, module, count, windowSeconds, threshold, samples) {
    try {
      const recentJoins = joiners.get(guild.id)?.length ?? 0;
      const res = await Promise.race([
        store.client.action("haimiya:classifyViolation", {
          guildId: guild.id,
          guildName: guild.name,
          module,
          count,
          windowSeconds,
          threshold,
          sampleMessages: samples,
          recentJoins,
          memberCount: guild.memberCount ?? undefined,
        }),
        new Promise((r) => setTimeout(() => r(null), 6000)),
      ]);
      if (!res || res.offline) return null;
      return res;
    } catch (err) {
      console.error("[ai:classify]", err.message);
      return null;
    }
  }

  /**
   * Phạt một thành viên theo danh sách hành động kết hợp của module (multi-select):
   * dùng hình phạt thành viên MẠNH NHẤT (ban > kick > timeout > warn); nếu không
   * chọn hình phạt nào thì chỉ dọn tin nhắn (delete/purge) mà không đụng thành viên.
   * Module nuke/raid: phạt trực tiếp (không nhiệt). Module moderation: cộng nhiệt
   * và tự tăng cấp nếu vượt ngưỡng.
   * Trả về mô tả hành động.
   */
  async function punishWithHeat(guild, member, moduleCfg, reason) {
    const actions = actionsOf(moduleCfg);
    const memberActions = actions.filter((a) => ["warn", "kick", "ban", "timeout"].includes(a));
    if (memberActions.length === 0) {
      return { action: "không phạt thành viên (chỉ dọn tin nhắn)", chosen: null, heatRes: null };
    }
    const base = memberPunishOf(actions, moduleCfg.punish || "warn");
    if (NUKE_MODULES.has(moduleCfg.module)) {
      const chosen = base;
      const action = await punishMember(guild, member, chosen, reason, moduleCfg.timeoutSeconds, store);
      return { action, chosen, heatRes: null };
    }
    const s = heatSettings(configOf(guild.id));
    const heatRes = await heat.add(
      guild.id,
      member.id,
      member.user?.username,
      moduleCfg.heat ?? 10,
      s,
    );
    const chosen = choosePunish(base, heatRes);
    const action = await punishMember(guild, member, chosen, reason, moduleCfg.timeoutSeconds, store);
    if (chosen !== "warn") heat.markPunished(guild.id, member.id);
    return { action: action + heatSummary(heatRes), chosen, heatRes };
  }

  // Lưu config đã đọc gần nhất để punishWithHeat tái sử dụng (tránh đọc lại DB).
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
    const actions = actionsOf(moduleCfg);
    try {
      const member = await guild.members.fetch(executor.id).catch(() => null);
      const reason = `[Protogon AntiNuke] ${MODULE_LABELS[module]}: ${count} lượt trong ${moduleCfg.windowSeconds}s (ngưỡng ${moduleCfg.threshold})`;
      if (member) {
        const res = await punishWithHeat(guild, member, moduleCfg, reason);
        action = res.action;
      } else if (actions.includes("ban")) {
        try {
          await guild.members.ban(executor.id, { reason });
          action = "đã ban";
        } catch {
          action = "không thể ban";
        }
      }
      await maybeLockdown(guild, config);
      // purgeMessages: xóa hàng loạt tin nhắn của thủ phạm trên toàn guild (giới hạn).
      if (actions.includes("purgeMessages")) {
        const cleanup = await cleanupMessages({
          guild,
          channel: null,
          userId: executor.id,
          actions: ["purgeMessages"],
          triggerMessage: null,
        });
        if (cleanup) action = `${action} · ${cleanup}`;
      }
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
      title: `🚨 Anti Nuke/Raid: ${MODULE_LABELS[module]}`,
      description: `Đã phát hiện **${count} lượt** trong **${moduleCfg.windowSeconds} giây** (ngưỡng ${moduleCfg.threshold}).`,
      color: Colors.Red,
      fields: [
        { name: "Thủ phạm", value: `<@${executor.id}>`, inline: true },
        { name: "Xử lý", value: action.slice(0, 1000), inline: true },
        { name: "Nguồn", value: "🛡️ Bot tự động phát hiện (anti nuke/raid)", inline: true },
        { name: "Module", value: `\`${module}\``, inline: true },
        ...(describeTarget ? [{ name: "Đối tượng", value: describeTarget, inline: false }] : []),
      ],
      footer: "Protogon · Anti Nuke/Raid",
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
    const actions = actionsOf(moduleCfg);
    // purgeMessages: giới hạn chỉ purge vài tài khoản mới nhất để tránh quá tải.
    let purgedCount = 0;
    const purgeLimit = actions.includes("purgeMessages") ? 3 : 0;
    for (const j of fresh) {
      const m = await guild.members.fetch(j.id).catch(() => null);
      if (!m || isExempt(m, moduleCfg, config)) continue;
      const res = await punishWithHeat(guild, m, moduleCfg, reason);
      results.push(`<@${j.id}>: ${res.action}`);
      if (purgedCount < purgeLimit) {
        const cleanup = await cleanupMessages({
          guild,
          channel: null,
          userId: j.id,
          actions: ["purgeMessages"],
          triggerMessage: null,
        });
        if (cleanup) purgedCount += 1;
      }
    }
    await maybeLockdown(guild, config);

    await recordEvent(guild.id, {
      module: "massJoin",
      executorId: undefined,
      executorName: undefined,
      action:
        results.length > 0
          ? `xử lý ${results.length} tài khoản (${moduleCfg.punish})${purgedCount > 0 ? ` · purge ${purgedCount} tài khoản` : ""}`
          : "không có tài khoản để xử lý",
      count: fresh.length,
      windowSeconds: moduleCfg.windowSeconds,
      threshold: moduleCfg.threshold,
      punish: moduleCfg.punish,
    });

    const embed = logEmbed({
      title: `🚨 Anti Nuke/Raid: Raid thành viên!`,
      description: `**${fresh.length}** thành viên tham gia trong **${moduleCfg.windowSeconds} giây** (ngưỡng ${moduleCfg.threshold}). Đã xử lý ${results.length} tài khoản.`,
      color: Colors.Red,
      fields: [
        ...(results.length > 0
          ? [{ name: "Kết quả xử lý", value: results.slice(0, 10).join("\n").slice(0, 1000) }]
          : []),
        { name: "Nguồn", value: "🛡️ Bot tự động phát hiện (anti nuke/raid)", inline: true },
      ],
      footer: "Protogon · Anti Nuke/Raid",
    });
    await sendLog(guild, config, embed);
  }

  /**
   * Phát hiện các mẫu tin nhắn gây nhiễu: tin dài cực dài / lặp nội dung và
   * tin "giả blank" (chỉ khoảng trắng + ký tự ẩn). Dùng AI để phân biệt raid
   * (leo thang phạt trực tiếp + lockdown) với vi phạm cá nhân (nhiệt bình thường).
   */
  async function handleMessagePatterns(message) {
    if (!message.guild) return;
    if (message.author.bot) return;
    if (message.channel.isDMBased?.()) return;
    const content = message.content || "";
    const config = await store.getConfig(message.guild.id);
    if (!config || !config.antinukeEnabled) return;
    lastConfigs.set(message.guild.id, config);
    const member = message.member;
    if (!member || isExempt(member, {}, config)) return;

    const userKey = `${message.guild.id}:${message.author.id}`;
    const recents = recentMessages.get(userKey) ?? [];
    recents.push({ content, ts: Date.now() });
    const freshRecents = recents.filter((m) => Date.now() - m.ts < 30_000).slice(-8);
    recentMessages.set(userKey, freshRecents);

    const modules = config.modules || [];
    const longCfg = modules.find((m) => m.module === "massMessage");
    const blankCfg = modules.find((m) => m.module === "blankNoise");

    const patterns = [];
    if (longCfg?.enabled) {
      // Tin dài cực dài hoặc lặp lại nội dung giống hệt nhiều lần.
      const isLong = content.length > LONG_MSG_LEN;
      const sameCount = freshRecents.filter((m) => m.content === content).length;
      if (isLong || sameCount >= 2) patterns.push({ cfg: longCfg, key: `${userKey}:long` });
    }
    if (blankCfg?.enabled) {
      const stripped = content.replace(ZERO_WIDTH_RE, "").trim();
      const isBlankNoise = content.length > 0 && stripped.length === 0;
      if (isBlankNoise) patterns.push({ cfg: blankCfg, key: `${userKey}:blank` });
    }

    for (const { cfg, key } of patterns) {
      const now = Date.now();
      const arr = patternBuckets.get(key) ?? [];
      arr.push(now);
      const cutoff = now - cfg.windowSeconds * 1000;
      const fresh = arr.filter((t) => t >= cutoff);
      patternBuckets.set(key, fresh);
      if (fresh.length < cfg.threshold) continue;

      patternBuckets.delete(key);
      const samples = freshRecents.map((m) => m.content.slice(0, 200));
      const ai = await aiClassify(
        message.guild,
        cfg.module,
        fresh.length,
        cfg.windowSeconds,
        cfg.threshold,
        samples,
      );
      // Chỉ coi là raid/nuke khi AI phân loại là "raid" VÀ độ tin cậy đủ cao
      // (>= 0.6) — tránh nhận diện nhầm gây ban nhầm + khóa kênh oan.
      const isRaid = ai?.classification === "raid" && (ai?.confidence ?? 0) >= 0.6;
      // AI xác định là dương tính giả → không phạt, chỉ ghi nhận.
      const isBenign = ai?.classification === "benign";
      const reason = `[Protogon] ${MODULE_LABELS[cfg.module]}: ${fresh.length} lần trong ${cfg.windowSeconds}s (ngưỡng ${cfg.threshold})${isRaid ? ` — AI: raid (${ai.reason ?? ""})` : ""}`;
      const actions = actionsOf(cfg);

      let action;
      let chosen;
      if (isRaid) {
        // Leo thang: phạt trực tiếp theo hình phạt nuke mặc định + lockdown.
        chosen = "ban";
        action = await punishMember(message.guild, member, "ban", reason, 0, store);
        await maybeLockdown(message.guild, config);
      } else if (isBenign) {
        // Dương tính giả: chỉ xóa tin nhắn, không phạt, không cộng nhiệt.
        action = "bỏ qua (AI: benign)";
        chosen = "none";
      } else {
        const res = await punishWithHeat(message.guild, member, cfg, reason);
        action = res.action;
        chosen = res.chosen;
      }
      // Dương tính giả (benign): không dọn tin, không phạt.
      if (!isBenign) {
        const cleanup = await cleanupMessages({
          guild: message.guild,
          channel: message.channel,
          userId: message.author.id,
          actions,
          triggerMessage: message,
        });
        if (cleanup) action = `${action} · ${cleanup}`;
      }

      await recordEvent(message.guild.id, {
        module: cfg.module,
        executorId: message.author.id,
        executorName: message.author.username,
        action: `${action}${isRaid ? " (AI: raid)" : ""}`,
        count: fresh.length,
        windowSeconds: cfg.windowSeconds,
        threshold: cfg.threshold,
        punish: chosen ?? "none",
      });

      const embed = logEmbed({
        title: `🚨 Auto Mod: ${MODULE_LABELS[cfg.module]}`,
        description: `<@${message.author.id}> đã gửi **${fresh.length} tin** thuộc mẫu \`${cfg.module}\` trong **${cfg.windowSeconds} giây** (ngưỡng ${cfg.threshold}). ${actions.includes("deleteMessages") || actions.includes("purgeMessages") ? "Tin nhắn liên quan đã được dọn theo cấu hình." : ""}`,
        color: isRaid ? Colors.Red : Colors.Orange,
        fields: [
          { name: "Thủ phạm", value: `<@${message.author.id}>`, inline: true },
          { name: "Xử lý", value: (action + (ai ? ` · AI: ${ai.classification} (${ai.confidence})` : "")).slice(0, 1000), inline: true },
          { name: "Nguồn", value: "⚙️ Bot tự động (auto-mod)", inline: true },
          { name: "Module", value: `\`${cfg.module}\``, inline: true },
        ],
        footer: "Protogon · Auto Mod",
      });
      await sendAutoModLog(message.guild, config, embed);
      return; // chỉ xử lý 1 pattern/tin nhắn
    }
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
    const samples = (recentMessages.get(key) ?? []).map((m) => m.content.slice(0, 200));
    const ai = await aiClassify(
      message.guild,
      "spam",
      fresh.length,
      moduleCfg.windowSeconds,
      moduleCfg.threshold,
      samples,
    );
    // Chỉ leo thang thành raid (ban + lockdown) khi AI tự tin >= 0.6.
    const isRaid = ai?.classification === "raid" && (ai?.confidence ?? 0) >= 0.6;
    const isBenign = ai?.classification === "benign";
    const reason = `[Protogon AntiNuke] Spam: ${fresh.length} tin nhắn trong ${moduleCfg.windowSeconds}s${isRaid ? ` — AI: raid (${ai.reason ?? ""})` : ""}`;

    const actions = actionsOf(moduleCfg);
    let action;
    let chosen;
    if (isRaid) {
      chosen = "ban";
      action = await punishMember(message.guild, member, "ban", reason, 0, store);
      await maybeLockdown(message.guild, config);
    } else if (isBenign) {
      action = "bỏ qua (AI: benign)";
      chosen = "none";
    } else {
      const res = await punishWithHeat(message.guild, member, moduleCfg, reason);
      action = res.action;
      chosen = res.chosen;
    }

    // Dọn tin nhắn theo hành động đã chọn (deleteMessages / purgeMessages).
    if (!isBenign) {
      const cleanup = await cleanupMessages({
        guild: message.guild,
        channel: message.channel,
        userId: message.author.id,
        actions,
        triggerMessage: message,
      });
      if (cleanup) action = `${action} · ${cleanup}`;
    }

    await recordEvent(message.guild.id, {
      module: "spam",
      executorId: message.author.id,
      executorName: message.author.username,
      action: `${action}${isRaid ? " (AI: raid)" : ""}`,
      count: fresh.length,
      windowSeconds: moduleCfg.windowSeconds,
      threshold: moduleCfg.threshold,
      punish: chosen ?? "none",
    });

    const embed = logEmbed({
      title: "🚨 Auto Mod: Chống spam tin nhắn",
      description: `<@${message.author.id}> đã gửi **${fresh.length} tin nhắn** trong **${moduleCfg.windowSeconds} giây** (ngưỡng ${moduleCfg.threshold}).`,
      color: isRaid ? Colors.Red : Colors.Orange,
      fields: [
        { name: "Thủ phạm", value: `<@${message.author.id}>`, inline: true },
        { name: "Xử lý", value: (action + (ai ? ` · AI: ${ai.classification} (${ai.confidence})` : "")).slice(0, 1000), inline: true },
        { name: "Nguồn", value: "⚙️ Bot tự động (auto-mod)", inline: true },
        { name: "Module", value: "`spam`", inline: true },
      ],
      footer: "Protogon · Auto Mod",
    });
    await sendAutoModLog(message.guild, config, embed);
  }

  /** Periodically unlock guilds whose lockdown expired or was requested. */
  async function tickUnlocks() {
    const now = Date.now();
    for (const guild of client.guilds.cache.values()) {
      try {
        const config = await store.getConfig(guild.id);
        if (!config) continue;
        const expired = config.lockdownUntil && config.lockdownUntil <= now;
        if (!isLocked(guild.id)) {
          if (expired) {
            // Hết hạn sau khi bot restart: overwrite vẫn còn trên Discord
            // nhưng bot không nhớ — phải markLocked rồi mở khóa để reset.
            markLocked(guild.id);
            await unlockGuild(client, guild, config, store);
          } else if (config.lockdownUntil) {
            // Vẫn đang trong thời gian khóa (restart giữa chừng): nhớ lại trạng thái.
            markLocked(guild.id);
          }
          continue;
        }
        if (config.lockdownRequested || expired) {
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

  /** Xử lý sự kiện audit log: tạo webhook / thread hàng loạt (không cần fetch lại). */
  async function handleAuditEntry(entry, guild, module, describeTarget) {
    if (!guild || guild.available === false) return;
    const config = await store.getConfig(guild.id);
    if (!config || !config.antinukeEnabled) return;
    lastConfigs.set(guild.id, config);
    const moduleCfg = config.modules.find((m) => m.module === module);
    if (!moduleCfg || !moduleCfg.enabled) return;
    const executor = entry.executor;
    if (executor && (executor.id === client.user.id || isExempt(executor, moduleCfg, config))) return;

    const count = record(guild.id, module, moduleCfg);
    if (executor && count < moduleCfg.threshold) return;
    if (!executor) return;

    let action = "đã ghi nhận";
    const actions = actionsOf(moduleCfg);
    try {
      const member = await guild.members.fetch(executor.id).catch(() => null);
      const reason = `[Protogon AntiNuke] ${MODULE_LABELS[module]}: ${count} lượt trong ${moduleCfg.windowSeconds}s (ngưỡng ${moduleCfg.threshold})`;
      if (member) {
        const res = await punishWithHeat(guild, member, moduleCfg, reason);
        action = res.action;
      } else if (actions.includes("ban")) {
        try {
          await guild.members.ban(executor.id, { reason });
          action = "đã ban";
        } catch {
          action = "không thể ban";
        }
      }
      await maybeLockdown(guild, config);
      // purgeMessages: xóa hàng loạt tin nhắn của thủ phạm trên toàn guild (giới hạn).
      if (actions.includes("purgeMessages")) {
        const cleanup = await cleanupMessages({
          guild,
          channel: null,
          userId: executor.id,
          actions: ["purgeMessages"],
          triggerMessage: null,
        });
        if (cleanup) action = `${action} · ${cleanup}`;
      }
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
      title: `🚨 Anti Nuke/Raid: ${MODULE_LABELS[module]}`,
      description: `Đã phát hiện **${count} lượt** trong **${moduleCfg.windowSeconds} giây** (ngưỡng ${moduleCfg.threshold}).`,
      color: Colors.Red,
      fields: [
        { name: "Thủ phạm", value: `<@${executor.id}>`, inline: true },
        { name: "Xử lý", value: action.slice(0, 1000), inline: true },
        { name: "Nguồn", value: "🛡️ Bot tự động phát hiện (anti nuke/raid)", inline: true },
        { name: "Module", value: `\`${module}\``, inline: true },
        ...(describeTarget ? [{ name: "Đối tượng", value: describeTarget, inline: false }] : []),
      ],
      footer: "Protogon · Anti Nuke/Raid",
    });
    await sendLog(guild, config, embed);
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
      void handleMessagePatterns(message).catch((e) => console.error("[antinuke:pattern]", e.message));
    });

    // Sự kiện audit log mới (discord.js >= 14.10) — webhook & thread creation.
    if (typeof client.on === "function" && AuditLogEvent.WebhookCreate !== undefined) {
      client.on("guildAuditLogEntryCreate", (entry, guild) => {
        if (entry.action === AuditLogEvent.WebhookCreate) {
          void handleAuditEntry(entry, guild, "massWebhookCreate", `Webhook "${entry.target?.name ?? "?"}"`).catch((e) =>
            console.error("[antinuke:webhookCreate]", e.message),
          );
        } else if (entry.action === AuditLogEvent.ThreadCreate) {
          void handleAuditEntry(entry, guild, "massThreadCreate", `Thread "#${entry.target?.name ?? "?"}"`).catch((e) =>
            console.error("[antinuke:threadCreate]", e.message),
          );
        }
      });
    }

    setInterval(() => {
      void tickUnlocks().catch((e) => console.error("[antinuke:tick]", e.message));
      void tickHeatResets().catch((e) => console.error("[heat:resetTick]", e.message));
      sweepMemory();
    }, 20_000);
  }

  return { attach, sweepMemory };
};

module.exports.MODULE_LABELS = MODULE_LABELS;
