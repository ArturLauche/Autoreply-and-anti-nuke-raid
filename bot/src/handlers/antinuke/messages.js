"use strict";
/**
 Lớp tin nhắn: spam flood + mẫu gây nhiễu (tin dài/lặp/blank); webhook → External App Guard. 
 */
const { sendCaseLog, CASE_LABEL } = require("../../caseLog");
const { isLocked, markLocked, lockGuild, unlockGuild } = require("../../lockdown");
const { heatSettings, punishMember, choosePunish, heatSummary } = require("../../heat");
const { actionsOf, memberPunishOf, cleanupMessages } = require("../../moduleActions");
const { emergencyRaidAlert } = require("../incidentReport");
const {
  MODULE_LABELS,
  KNOWN_LOGGING_BOTS,
  isKnownLoggingBot,
  NUKE_MODULES,
  IMMEDIATE_BOT_NUKE,
  strangeBotVerdict,
  botHitAndRunVerdict,
  isTrustedBotMember,
  isExempt,
  moduleCfgOf,
  memberSuspicionScore,
  joinClusterSuspicion,
  messageFingerprint,
  isExternalAppSpam,
  LONG_MSG_LEN,
  ZERO_WIDTH_RE,
} = require("./shared");

module.exports = function createAntiNukeLayer({ client, store, heat, state, core, ai, raidIntel, externalApp }) {
  const { recordEvent } = state;
  const { spamBuckets, patternBuckets, recentMessages, lastConfigs } = state.state;
  const { punishWithHeat, maybeLockdown } = core;
  const { aiClassify } = ai;
  const { recordRaidSample } = raidIntel;
  const { handleExternalAppMessage } = externalApp;

  /**
   * Phát hiện các mẫu tin nhắn gây nhiễu: tin dài cực dài / lặp nội dung và
   * tin "giả blank" (chỉ khoảng trắng + ký tự ẩn). Dùng AI để phân biệt raid
   * (leo thang phạt trực tiếp + lockdown) với vi phạm cá nhân (nhiệt bình thường).
   */
  async function handleMessagePatterns(message) {
    if (!message.guild) return;
    // Tin qua WEBHOOK = EXTERNAL APP (app kết nối từ ngoài, KHÔNG phải thành viên
    // server) → xử lý riêng ở External App Guard. BOT ĐƯỢC MỜI vào server (author bot,
    // là thành viên) vẫn bị soi các module chống nuke như thành viên thường — bot mà
    // trigger module (spam dài/lặp, blank...) sẽ bị phạt THẲNG TAY theo cấu hình.
    if (message.webhookId) {
      await handleExternalAppMessage(message);
      return;
    }
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
      let caseNumber;
      if (isRaid) {
        // Leo thang: phạt trực tiếp theo hình phạt nuke mặc định + lockdown.
        chosen = "ban";
        const res = await punishMember(message.guild, member, "ban", reason, 0, store);
        action = res.action;
        caseNumber = res.caseNumber;
        await maybeLockdown(message.guild, config);
        // AI xác nhận raid → cảnh báo khẩn cho server (fire-and-forget).
        emergencyRaidAlert(client, store, message.guild, {
          summary: "AI xác nhận raid (spam) — " + fresh.length + " tin trong " + cfg.windowSeconds + "s",
          reason,
          lockdownActive: isLocked(message.guild.id),
        }).catch(() => {});
      } else if (isBenign) {
        // Dương tính giả: chỉ xóa tin nhắn, không phạt, không cộng nhiệt.
        action = "bỏ qua (AI: benign)";
        chosen = "none";
      } else {
        const res = await punishWithHeat(message.guild, member, cfg, reason);
        action = res.action;
        caseNumber = res.caseNumber;
        chosen = res.chosen;
      }
      // Dương tính giả (benign): không dọn tin, không phạt.
      let cleanup = "";
      if (!isBenign) {
        cleanup = await cleanupMessages({
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

      const offender = { id: message.author.id, username: message.author.username };
      // Log xóa tin nhắn kiểu Carl-bot ("Message deleted") vào kênh log moderation.
      if (cleanup) {
        try {
          await sendCaseLog({
            guild: message.guild,
            guildConfig: config,
            action: "delete",
            offender,
            reason: `Bot tự động xóa tin nhắn vì ${MODULE_LABELS[cfg.module]} (${fresh.length} tin trong ${cfg.windowSeconds}s)`,
            executor: null,
          });
        } catch (e) {
          console.error("[antinuke:pattern:delLog]", e.message);
        }
      }
      // Embed case kiểu Carl-bot cho phạt tự động (responsible moderator = tên bot).
      if (!isBenign) {
        try {
          await sendCaseLog({
            guild: message.guild,
            guildConfig: config,
            action: chosen === "none" ? "warn" : chosen,
            caseNumber,
            offender,
            reason: `Tự động xử lý vì ${MODULE_LABELS[cfg.module]}: ${fresh.length} lần trong ${cfg.windowSeconds}s${isRaid ? ` — AI xác nhận raid (${ai?.reason ?? ""})` : ""}${cleanup ? ` · đã ${cleanup}` : ""}`.slice(0, 1000),
            executor: null,
          });
        } catch (e) {
          console.error("[antinuke:pattern:case]", e.message);
        }
      }
      // Raid Intel: ghi mẫu huấn luyện kèm AI verdict (raid/individual/benign).
      if (!isBenign) {
        await recordRaidSample(message.guild, config, {
          module: cfg.module,
          count: fresh.length,
          windowSeconds: cfg.windowSeconds,
          threshold: cfg.threshold,
          action,
          punish: chosen ?? "none",
          aiClassification: ai?.classification,
          aiConfidence: ai?.confidence,
          aiReason: ai?.reason,
          lockdownTriggered: isLocked(message.guild.id),
        });
      }
      return; // chỉ xử lý 1 pattern/tin nhắn
    }
  }

  async function handleSpam(message) {
    if (!message.guild) return;
    // Bot ĐƯỢC MỜI vào server cũng bị soi chống spam như thành viên thường — bot mà
    // trigger module sẽ bị phạt thẳng tay theo cấu hình (webhook thì message.member
    // là null nên tự bỏ qua ở đây — webhook do External App Guard xử lý).
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
    // Ghi mẫu tin nhắn spam cho n-gram engine (threat intel cục bộ, 0 token).
    try {
      require("../../threatEngine").noteFlaggedMessage(message.content, message.guild.id, "spam");
    } catch {}
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
    let caseNumber;
    if (isRaid) {
      chosen = "ban";
      const res = await punishMember(message.guild, member, "ban", reason, 0, store);
      action = res.action;
      caseNumber = res.caseNumber;
      await maybeLockdown(message.guild, config);
    } else if (isBenign) {
      action = "bỏ qua (AI: benign)";
      chosen = "none";
    } else {
      const res = await punishWithHeat(message.guild, member, moduleCfg, reason);
      action = res.action;
      caseNumber = res.caseNumber;
      chosen = res.chosen;
    }

    // Dọn tin nhắn theo hành động đã chọn (deleteMessages / purgeMessages).
    let cleanup = "";
    if (!isBenign) {
      cleanup = await cleanupMessages({
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

    const offender = { id: message.author.id, username: message.author.username };
    // Log xóa tin nhắn kiểu Carl-bot ("Message deleted") vào kênh log moderation.
    if (cleanup) {
      try {
        await sendCaseLog({
          guild: message.guild,
          guildConfig: config,
          action: "delete",
          offender,
          reason: `Bot tự động xóa tin nhắn vì spam (${fresh.length} tin trong ${moduleCfg.windowSeconds}s)`,
          executor: null,
        });
      } catch (e) {
        console.error("[antinuke:spam:delLog]", e.message);
      }
    }
    // Embed case kiểu Carl-bot cho phạt tự động (responsible moderator = tên bot).
    if (!isBenign) {
      try {
        await sendCaseLog({
          guild: message.guild,
          guildConfig: config,
          action: chosen === "none" ? "warn" : chosen,
          caseNumber,
          offender,
          reason: `Tự động xử lý vì spam tin nhắn: ${fresh.length} tin trong ${moduleCfg.windowSeconds}s${isRaid ? ` — AI xác nhận raid (${ai?.reason ?? ""})` : ""}${cleanup ? ` · đã ${cleanup}` : ""}`.slice(0, 1000),
          executor: null,
        });
      } catch (e) {
        console.error("[antinuke:spam:case]", e.message);
      }
    }
    // Raid Intel: ghi mẫu huấn luyện kèm AI verdict (raid/individual/benign).
    if (!isBenign) {
      await recordRaidSample(message.guild, config, {
        module: moduleCfg.module,
        count: fresh.length,
        windowSeconds: moduleCfg.windowSeconds,
        threshold: moduleCfg.threshold,
        action,
        punish: chosen ?? "none",
        aiClassification: ai?.classification,
        aiConfidence: ai?.confidence,
        aiReason: ai?.reason,
        lockdownTriggered: isLocked(message.guild.id),
      });
    }
  }

  return { handleMessagePatterns, handleSpam };
};
