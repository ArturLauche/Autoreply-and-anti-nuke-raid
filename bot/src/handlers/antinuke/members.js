"use strict";
/**
 Xử lý thành viên: cảnh báo bot lạ, bot hit-and-run, raid massJoin (gate chống ban nhầm). 
 */
const { AuditLogEvent, Colors, PermissionFlagsBits } = require("discord.js");
const { logEmbed, sendLog } = require("../../util");
const { sendCaseLog } = require("../../caseLog");
const { isLocked } = require("../../lockdown");
const { actionsOf, cleanupMessages } = require("../../moduleActions");
const {
  MODULE_LABELS,
  isKnownLoggingBot,
  strangeBotVerdict,
  botHitAndRunVerdict,
  isTrustedBotMember,
  isExempt,
  memberSuspicionScore,
  joinClusterSuspicion,
  joinWaveVerdict,
} = require("./shared");

module.exports = function createAntiNukeLayer({ store, state, core, ai, raidIntel }) {
  const { recordEvent, markHandled, wasHandled, auditExecutor } = state;
  const { joiners, lastConfigs, botAddTimes } = state.state;
  const { punishWithHeat, maybeLockdown } = core;
  const { clusterStats } = ai;
  // Ý kiến thứ hai của AI (best-effort, có thể không có trong test) — dùng để
  // PHỦ QUYẾT cụm nghi vấn trước khi phạt (chống báo raid tào lao).
  const { aiAnalyzeRaid } = ai ?? {};
  const { huntRaidSource, recordRaidSample } = raidIntel;
  // 1 làn sóng join = 1 lần xử lý + 1 thông báo. Join nối tiếp trong cùng đợt
  // KHÔNG bắn thêm sự kiện/phạt lặp (trước đây mỗi join vượt ngưỡng chạy lại
  // toàn bộ pipeline → log trùng + phạt lặp + lockdown lặp).
  const WAVE_KEY = "__wave__";

  /**
   * Cảnh báo bot lạ mới được thêm vào server — CHỈ CẢNH BÁO, không phạt.
   * Bỏ qua: bot logging hợp pháp, bot có tick xác minh, bot được whitelist.
   * Bot lạ có acc < 30 ngày được cảnh báo mạnh hơn (mẫu bot nuke điển hình).
   */
  async function handleSuspiciousBotJoin(member) {
    try {
      const user = member.user ?? {};
      if (user.bot !== true) return;
      const verdict = strangeBotVerdict({ user });
      if (!verdict.alert) return;
      const guild = member.guild;
      if (!guild) return;

      const config = await store.getConfig(guild.id);
      if (!config || !config.antinukeEnabled) return;
      const moduleCfg = config.modules.find((m) => m.module === "suspiciousBotAlert");
      if (!moduleCfg || !moduleCfg.enabled) return;
      if (isExempt(member, moduleCfg, config)) return;
      // Chống spam cảnh báo: cùng 1 bot vào/ra liên tục trong 10 phút chỉ cảnh báo 1 lần.
      if (wasHandled(guild.id, "suspiciousBotAlert", member.id)) return;
      markHandled(guild.id, "suspiciousBotAlert", member.id, 10 * 60_000);

      // Ai đã thêm bot này vào? (audit BotAdd theo target = bot)
      const adder = await auditExecutor(guild, AuditLogEvent.BotAdd, member.id).catch(() => null);

      const ageDays = user.createdAt
        ? Math.floor((Date.now() - user.createdAt) / 86_400_000)
        : null;
      // Threat Relay (Đợt 6): đóng góp tên bot lạ (fire-and-forget — Convex kiểm
      // relayShare; nhiều server cùng thấy 1 bot → weight tăng → mạng cảnh giác).
      if (user.username) {
        require("../../relayClient").reportSignature(guild.id, "bot-name", user.username);
      }
      const perms = member.permissions;
      const flags = [];
      if (perms?.has?.(PermissionFlagsBits.Administrator)) flags.push("⚠️ Administrator");
      else {
        if (perms?.has?.(PermissionFlagsBits.ManageGuild)) flags.push("Manage Server");
        if (perms?.has?.(PermissionFlagsBits.ManageRoles)) flags.push("Manage Roles");
        if (perms?.has?.(PermissionFlagsBits.ManageWebhooks)) flags.push("Manage Webhooks");
        if (perms?.has?.(PermissionFlagsBits.BanMembers)) flags.push("Ban Members");
      }
      const permText = flags.length > 0 ? flags.join(", ") : "quyền thường";

      const embed = logEmbed({
        title: `👁️ Bot lạ mới vào server: ${user.username ?? member.id}`,
        description: verdict.youngAcc
          ? "Bot KHÔNG rõ nguồn gốc với **tài khoản application dưới 30 ngày tuổi** — mẫu phổ biến của bot nuke/scam. Theo dõi sát: nếu nó tự rời ngay, module hit-and-run sẽ xử lý."
          : "Bot chưa rõ nguồn gốc (không có tick xác minh Discord). Nếu đây là bot bạn tin cậy, thêm nó vào **Whitelist** để tắt cảnh báo." +
            " Nếu bot tự rời ngay sau khi được thêm, module hit-and-run sẽ tự xử lý.",
        color: verdict.youngAcc ? Colors.Orange : Colors.Yellow,
        fields: [
          { name: "Bot", value: `<@${member.id}> (${user.tag ?? member.id})`, inline: true },
          { name: "Người thêm", value: adder ? `<@${adder.id}>` : "không rõ", inline: true },
          {
            name: "Tuổi tài khoản bot",
            value: ageDays !== null ? `${ageDays} ngày` : "không rõ",
            inline: true,
          },
          { name: "Quyền trong server", value: permText.slice(0, 1000), inline: false },
          {
            name: "Tick xác minh",
            value: "❌ Không (bot chưa được Discord xác minh)",
            inline: true,
          },
        ],
        footer: "Protogon · Cảnh báo sơ bộ (không phạt)",
      });
      await sendLog(guild, config, embed, "antinuke");
      await recordEvent(guild.id, {
        module: "suspiciousBotAlert",
        executorId: member.id,
        executorName: user.username ?? undefined,
        action: "đã cảnh báo (không phạt)",
        count: 1,
        windowSeconds: moduleCfg.windowSeconds,
        threshold: moduleCfg.threshold,
        punish: "warn",
      });
    } catch (e) {
      console.error("[antinuke:botAlert]", e.message);
    }
  }
  async function handleHitAndRunLeave(member, kickExecutor) {
    try {
      const user = member.user ?? {};
      if (user.bot !== true) return; // chỉ bot
      const guild = member.guild;
      if (!guild) return;
      const key = `${guild.id}:${member.id}`;
      const addedAt = botAddTimes.get(key);
      botAddTimes.delete(key); // một lần rời là hết — không dùng lại entry cũ
      if (!addedAt || kickExecutor) return; // thiếu thời điểm thêm / bị kick → không kết luận
      if (isKnownLoggingBot(user)) return; // bot logging tự gỡ cấu hình là việc bình thường
      const trusted = isTrustedBotMember(member, guild);
      if (!botHitAndRunVerdict({ addedAt, leftAt: Date.now(), trusted, isBot: true })) return;

      const config = await store.getConfig(guild.id);
      if (!config || !config.antinukeEnabled) return;
      const moduleCfg = config.modules.find((m) => m.module === "botHitAndRun");
      if (!moduleCfg || !moduleCfg.enabled) return;
      if (isExempt(member, moduleCfg, config)) return;

      const staySec = Math.max(1, Math.round((Date.now() - addedAt) / 1000));
      const reason = `[Protogon AntiNuke] ${MODULE_LABELS.botHitAndRun}: bot rời server sau ${staySec}s kể từ khi được thêm`;
      let action = "đã ghi nhận";
      let punishCaseNumber;
      let punishChosen;
      try {
        const res = await punishWithHeat(guild, member, moduleCfg, reason);
        action = res.action;
        punishCaseNumber = res.caseNumber;
        punishChosen = res.chosen;
      } catch {
        action = "không thể xử lý";
      }
      await maybeLockdown(guild, config);
      await recordEvent(guild.id, {
        module: "botHitAndRun",
        executorId: member.id,
        executorName: user.username ?? undefined,
        action,
        count: 1,
        windowSeconds: moduleCfg.windowSeconds,
        threshold: moduleCfg.threshold,
        punish: moduleCfg.punish,
      });
      const embed = logEmbed({
        title: `🚨 Anti Nuke/Raid: ${MODULE_LABELS.botHitAndRun}`,
        description: `Bot vào server rồi TỰ RỜI ngay sau **${staySec} giây** — mẫu bot nuke kinh điển (phá hoại xong rời để dọn dấu vết, né audit log).`,
        color: Colors.Red,
        fields: [
          { name: "Bot", value: `<@${member.id}> (${user.tag ?? member.id})`, inline: true },
          { name: "Xử lý", value: action.slice(0, 1000), inline: true },
          { name: "Module", value: "`botHitAndRun`", inline: true },
        ],
        footer: "Protogon · Anti Nuke/Raid",
      });
      await sendLog(guild, config, embed);
      if (punishChosen) {
        try {
          await sendCaseLog({
            guild,
            guildConfig: config,
            action: punishChosen,
            caseNumber: punishCaseNumber,
            offender: { id: member.id, username: user.username || member.id },
            reason: "[AntiNuke] botHitAndRun: tự rời ngay sau khi được thêm",
            executor: null,
          });
        } catch (e) {
          console.error("[antinuke:hitAndRun:caseLog]", e.message);
        }
      }
    } catch (e) {
      console.error("[antinuke:hitAndRun]", e.message);
    }
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

    // CHỐNG XỬ LÝ TRÙNG 1 làn sóng: join đầu chạm ngưỡng đánh dấu NGAY (đồng
    // bộ, trước mọi await) để các join nối tiếp trong cùng đợt bỏ qua — trước
    // đây mỗi join vượt ngưỡng chạy lại toàn bộ pipeline → log trùng, phạt
    // lặp, lockdown lặp, mẫu raid trùng. Cooldown = cửa sổ module (đuôi sóng
    // cũ tự rớt khỏi cửa sổ khi cooldown hết).
    const waveCooldownMs = Math.max(30_000, (moduleCfg.windowSeconds || 10) * 1000);
    if (wasHandled(guild.id, "massJoin", WAVE_KEY)) return;
    markHandled(guild.id, "massJoin", WAVE_KEY, waveCooldownMs);
    // Đợt mới đếm độc lập — tránh cộng dồn đuôi sóng cũ vào sóng sau.
    joiners.set(guild.id, []);

    // CHỐNG BAN NHẦM: soi hồ sơ toàn cụm TRƯỚC khi phạt (trước đây đủ ngưỡng là
    // kick + khóa kênh ngay cả với làn sóng thành viên thật → ban oan cả server).
    // Raid thật: đa số acc mới/default avatar. Tăng trưởng tự nhiên: hồ sơ bình thường
    // → chỉ ghi nhận, KHÔNG phạt, KHÔNG khóa kênh, KHÔNG gửi thông báo raid.
    const profiles = []; // hồ sơ cụm tài khoản raid → Raid Intel
    for (const j of fresh) {
      const m = await guild.members.fetch(j.id).catch(() => null);
      if (!m || isExempt(m, moduleCfg, config)) continue;
      profiles.push({
        id: m.id,
        username: m.user?.username,
        avatar: m.user?.avatar,
        createdAt: m.user?.createdTimestamp,
        joinedAt: j.ts,
      });
    }
    const sus = joinClusterSuspicion(profiles);
    let verdict = joinWaveVerdict(sus);

    // Ý KIẾN THỨ HAI CỦA AI (best-effort): AI phân tích hồ sơ cụm và PHỦ QUYẾT
    // khi kết luận KHÔNG phối hợp với độ tin cậy đủ → hạ raid/watch xuống mức
    // nhẹ hơn. AI offline/lỗi/thiếu → giữ nguyên phán quyết deterministic.
    if (verdict.level !== "calm" && typeof aiAnalyzeRaid === "function") {
      try {
        const now = Date.now();
        const lines = profiles
          .slice(0, 12)
          .map((p, i) => {
            const age = p.createdAt ? Math.round((now - p.createdAt) / 86_400_000) : "?";
            return `${i + 1}. ${p.username || "?"} (acc ${age} ngày, avatar ${p.avatar ? "có" : "không"})`;
          })
          .join("\n");
        // Bằng chứng engine: tuổi acc + avatar + username dạng máy tính từ profiles.
        const ages = profiles
          .map((p) => (p.createdAt ? Math.round((now - p.createdAt) / 86_400_000) : null))
          .filter((a) => a != null);
        const freshAccs = ages.filter((a) => a < 7).length;
        const noAvatarN = profiles.filter((p) => !p.avatar).length;
        const machineNamed = profiles.filter(
          (p) =>
            /^(user|member|raid|bot|nak|acc)/i.test(p.username || "") &&
            /\d{2,}$/.test(p.username || ""),
        ).length;
        const aiRes = await aiAnalyzeRaid(
          guild,
          "massJoin",
          fresh.length,
          moduleCfg.windowSeconds,
          moduleCfg.threshold,
          lines,
          undefined,
          {
            evidence: [
              ages.length ? `Tuổi acc: ${freshAccs}/${ages.length} dưới 7 ngày` : null,
              noAvatarN > 0 ? `Avatar mặc định: ${noAvatarN}/${profiles.length} tài khoản` : null,
              machineNamed > 0
                ? `Username dạng máy (tiền tố + đuôi số): ${machineNamed}/${profiles.length}`
                : null,
              `${fresh.length} tài khoản vào trong ${moduleCfg.windowSeconds}s (ngưỡng ${moduleCfg.threshold})`,
            ],
          },
        );
        if (aiRes && aiRes.offline !== true && typeof aiRes.coordinated === "boolean") {
          const aiWhy = aiRes.reasoning || aiRes.reason || "";
          if (aiRes.coordinated === false && (aiRes.confidence ?? 0) >= 0.5) {
            verdict = {
              level: "watch",
              reason: `AI đánh giá KHÔNG phối hợp (${aiWhy}) — chỉ theo dõi`,
            };
          } else if (
            aiRes.coordinated === true &&
            (aiRes.confidence ?? 0) >= 0.8 &&
            verdict.level === "watch"
          ) {
            verdict = { level: "raid", reason: `AI xác nhận phối hợp (${aiWhy})` };
          }
        }
      } catch {
        // AI lỗi → giữ phán quyết deterministic
      }
    }

    if (verdict.level === "calm") {
      await recordEvent(guild.id, {
        module: "massJoin",
        action: `bỏ qua — ${verdict.reason}`,
        count: fresh.length,
        windowSeconds: moduleCfg.windowSeconds,
        threshold: moduleCfg.threshold,
        punish: "none",
      });
      // Hồ sơ bình thường → KHÔNG gửi thông báo ra kênh (chống spam "bị raid").
      return;
    }

    if (verdict.level === "watch") {
      await recordEvent(guild.id, {
        module: "massJoin",
        action: `theo dõi — ${verdict.reason}`,
        count: fresh.length,
        windowSeconds: moduleCfg.windowSeconds,
        threshold: moduleCfg.threshold,
        punish: "none",
      });
      await sendLog(
        guild,
        config,
        logEmbed({
          title: "👀 Anti Nuke/Raid: Theo dõi làn sóng vào nhanh",
          description: `**${fresh.length}** thành viên vào trong **${moduleCfg.windowSeconds}s** — ${verdict.reason}. Bot chỉ theo dõi, chưa xử lý ai.`,
          color: Colors.Yellow,
          fields: [
            {
              name: "Tài khoản đáng ngờ",
              value: `${sus.suspicious}/${sus.total || 0}`,
              inline: true,
            },
            {
              name: "Tín hiệu",
              value: (sus.strongSignals || []).join(", ") || "không rõ",
              inline: true,
            },
            { name: "Nguồn", value: "🛡️ Tự động — theo dõi", inline: true },
          ],
          footer: "Protogon · Anti Nuke/Raid",
        }),
        "general",
      );
      return;
    }

    // Mức "raid": cụm đáng ngờ + có tín hiệu phối hợp. Gate CÁ NHÂN nâng lên
    // điểm >= 4 — acc mới (2đ) PHẢI kèm thêm ÍT NHẤT 2 tín hiệu độc lập nữa
    // mới bị phạt (trước đây acc mới + default avatar = 3đ đã bị kick → oan
    // người thật mới lập acc trong sóng đông).
    const punishable = profiles.filter(
      (p) =>
        memberSuspicionScore({
          id: p.id,
          username: p.username,
          avatar: p.avatar,
          createdAt: p.createdAt,
        }) >= 4,
    );
    if (punishable.length === 0) {
      // Cụm "raid" nhưng không acc nào đủ bar phạt cá nhân → hạ cấp theo dõi:
      // không lockdown, không báo động đỏ oan.
      await recordEvent(guild.id, {
        module: "massJoin",
        action: `theo dõi — cụm nghi vấn nhưng không có tài khoản nào đủ ngưỡng phạt (${verdict.reason})`,
        count: fresh.length,
        windowSeconds: moduleCfg.windowSeconds,
        threshold: moduleCfg.threshold,
        punish: "none",
      });
      await sendLog(
        guild,
        config,
        logEmbed({
          title: "👀 Anti Nuke/Raid: Theo dõi làn sóng vào nhanh",
          description: `**${fresh.length}** thành viên vào trong **${moduleCfg.windowSeconds}s** — cụm nghi vấn nhưng không có tài khoản nào đủ ngưỡng phạt cá nhân. Bot chỉ theo dõi.`,
          color: Colors.Yellow,
          fields: [
            {
              name: "Tài khoản đáng ngờ",
              value: `${sus.suspicious}/${sus.total || 0}`,
              inline: true,
            },
            { name: "Nguồn", value: "🛡️ Tự động — theo dõi", inline: true },
          ],
          footer: "Protogon · Anti Nuke/Raid",
        }),
        "general",
      );
      return;
    }

    const reason = `[Protogon AntiNuke] Raid thành viên: ${fresh.length} người tham gia trong ${moduleCfg.windowSeconds}s`;
    const results = [];
    const skippedReal = []; // hồ sơ bình thường — được miễn trong cụm hỗn hợp
    const actions = actionsOf(moduleCfg);
    // purgeMessages: giới hạn chỉ purge vài tài khoản mới nhất để tránh quá tải.
    let purgedCount = 0;
    const purgeLimit = actions.includes("purgeMessages") ? 3 : 0;
    for (const j of fresh) {
      // Đợt đã xử lý acc này rồi (sóng dài quá cooldown) → bỏ qua, chống phạt lặp.
      if (wasHandled(guild.id, "massJoin", j.id)) continue;
      const m = await guild.members.fetch(j.id).catch(() => null);
      if (!m || isExempt(m, moduleCfg, config)) continue;
      // CHỐNG BAN NHẦM CÁ NHÂN: trong cụm hỗn hợp (raid lẫn người thật), chỉ phạt
      // tài khoản ĐỦ 2 tín hiệu độc lập trở lên (điểm >= 4: acc mới + avatar mặc
      // định + tên máy, hoặc các tổ hợp tương đương). Thành viên thật đi kèm làn
      // sóng (acc cũ, có avatar, tên người) được bỏ qua thay vì bị kick oan cả cụm.
      if (
        memberSuspicionScore({
          id: m.id,
          username: m.user?.username,
          avatar: m.user?.avatar,
          createdAt: m.user?.createdTimestamp,
        }) < 4
      ) {
        skippedReal.push(m.id);
        continue;
      }
      const res = await punishWithHeat(guild, m, moduleCfg, reason);
      markHandled(
        guild.id,
        "massJoin",
        j.id,
        Math.max(120_000, (moduleCfg.windowSeconds || 10) * 6 * 1000),
      );
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
          ? `xử lý ${results.length} tài khoản (${moduleCfg.punish})${skippedReal.length ? ` · bỏ qua ${skippedReal.length} hồ sơ bình thường` : ""}${purgedCount > 0 ? ` · purge ${purgedCount} tài khoản` : ""}`
          : skippedReal.length
            ? `bỏ qua ${skippedReal.length} hồ sơ bình thường trong cụm`
            : "không có tài khoản để xử lý",
      count: fresh.length,
      windowSeconds: moduleCfg.windowSeconds,
      threshold: moduleCfg.threshold,
      punish: moduleCfg.punish,
    });

    // Raid Intel: săn NGUỒN CƠN raid trong cụm tài khoản vừa vào + ghi mẫu huấn luyện.
    const sourceHunt = await huntRaidSource(guild, config, profiles);
    await recordRaidSample(guild, config, {
      module: "massJoin",
      count: fresh.length,
      windowSeconds: moduleCfg.windowSeconds,
      threshold: moduleCfg.threshold,
      action: results.length
        ? `xử lý ${results.length} tài khoản (${moduleCfg.punish})`
        : "không có tài khoản để xử lý",
      punish: moduleCfg.punish,
      lockdownTriggered: isLocked(guild.id),
      punishedCount: results.length,
      ...clusterStats(profiles),
      sourceHunt,
    });
    if (sourceHunt?.banned) {
      // Ghi lại vụ ban nguồn cơn vào sự kiện để báo cáo hàng ngày + dashboard thấy.
      await recordEvent(guild.id, {
        module: "raidIntel",
        executorId: sourceHunt.suspectedSourceId ?? undefined,
        executorName: sourceHunt.suspectedSourceName ?? undefined,
        action: `Raid Intel: ban nguồn cơn (${sourceHunt.reason})`,
        count: fresh.length,
        windowSeconds: moduleCfg.windowSeconds,
        threshold: moduleCfg.threshold,
        punish: "ban",
      }).catch(() => {});
    }

    const embed = logEmbed({
      title: `🚨 Anti Nuke/Raid: Raid thành viên!`,
      description: `**${fresh.length}** thành viên tham gia trong **${moduleCfg.windowSeconds} giây** (ngưỡng ${moduleCfg.threshold}). Đã xử lý ${results.length} tài khoản.`,
      color: Colors.Red,
      fields: [
        ...(results.length > 0
          ? [{ name: "Kết quả xử lý", value: results.slice(0, 10).join("\n").slice(0, 1000) }]
          : []),
        { name: "Nguồn", value: "🛡️ Bot tự động phát hiện (anti nuke/raid)", inline: true },
        ...(sourceHunt && sourceHunt.banned
          ? [
              {
                name: "Raid Intel",
                value: `🎯 Đã ban nguồn cơn nghi ngờ: **${sourceHunt.suspectedSourceName ?? "?"}** — ${sourceHunt.reason}`,
              },
            ]
          : []),
      ],
      footer: "Protogon · Anti Nuke/Raid",
    });
    await sendLog(guild, config, embed);
  }

  return { handleSuspiciousBotJoin, handleHitAndRunLeave, handleRaidJoin };
};
