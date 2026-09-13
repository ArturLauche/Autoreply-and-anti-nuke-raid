const { EmbedBuilder, Colors, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require("discord.js");
const { canManageGuild, isAdmin, canManageWithConfig } = require("../util");
const { isLocked, markLocked, unlockGuild } = require("../lockdown");
const { emojiKeyOf } = require("./hidden");
const {
  parseDuration,
  canMod,
  timeoutMember,
  kickMember,
  banMember,
  purgeChannel,
  untimeoutMember,
  unbanMember,
  unwarnMember,
} = require("./modTools");

const MODULES = [
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
  "spam",
  "massMessage",
  "blankNoise",
  "mention",
  "badword",
  "attachment",
  "invite",
  "malware",
];

function needPerm(interaction) {
  return interaction.reply({
    content: "❌ Bạn không có quyền dùng lệnh này — cần quyền **Quản lý server** hoặc role **Mod/Admin** được cấu hình qua `/setup`.",
    ephemeral: true,
  });
}

/** Phân tích chuỗi "emoji:role emoji:role" (role là ID hoặc <@&id> hoặc tên role). */
function parsePairs(pairsRaw, guild) {
  if (!pairsRaw) return [];
  const entries = [];
  const tokens = String(pairsRaw).split(/\s+/).filter(Boolean);
  for (const token of tokens) {
    const idx = token.lastIndexOf(":");
    if (idx <= 0 || idx === token.length - 1) continue;
    const emoji = token.slice(0, idx).trim();
    let roleId = token.slice(idx + 1).trim().replace(/^<@&(\d+)>$/, "$1");
    if (!emoji) continue;
    if (!/^\d{15,20}$/.test(roleId)) {
      const role = guild?.roles.cache.find((r) => r.name.toLowerCase() === roleId.toLowerCase());
      if (role) roleId = role.id;
    }
    if (!/^\d{15,20}$/.test(roleId)) continue;
    entries.push({ emoji, roleId });
  }
  return entries.slice(0, 20);
}

const { genCaptcha, setCode } = require("../captchaStore");
const { analyzeNewMember, executePunishment, buildRiskEmbed } = require("../altDetection");
const { reportInteractive } = require("./incidentReport");

// Rate limiting for verify attempts: Map<userId, { attempts: number, lastAttemptAt: number }>
const verifyAttempts = new Map();
const VERIFY_RATE_LIMIT = 3; // Max attempts per 10 minutes
const VERIFY_RATE_WINDOW_MS = 10 * 60 * 1000;

function checkVerifyRateLimit(userId) {
  const now = Date.now();
  const data = verifyAttempts.get(userId);
  if (!data || now - data.lastAttemptAt > VERIFY_RATE_WINDOW_MS) {
    verifyAttempts.set(userId, { attempts: 1, lastAttemptAt: now });
    return { allowed: true, remaining: VERIFY_RATE_LIMIT - 1 };
  }
  if (data.attempts >= VERIFY_RATE_LIMIT) {
    return { allowed: false, remaining: 0, retryAfterMs: VERIFY_RATE_WINDOW_MS - (now - data.lastAttemptAt) };
  }
  data.attempts++;
  data.lastAttemptAt = now;
  return { allowed: true, remaining: VERIFY_RATE_LIMIT - data.attempts };
}

// Cleanup old entries every 5 minutes
setInterval(() => {
  const cutoff = Date.now() - VERIFY_RATE_WINDOW_MS;
  for (const [userId, data] of verifyAttempts) {
    if (data.lastAttemptAt < cutoff) verifyAttempts.delete(userId);
  }
}, 5 * 60 * 1000);

module.exports = async function onInteractionCreate(client, interaction, store, heat) {
  // Handle button interactions (verify_confirm + verify_request_captcha)
  if (interaction.isButton()) {
    if (interaction.customId === "verify_request_captcha") {
      const guild = interaction.guild;
      if (!guild) return;
      const config = await store.getConfig(guild.id);
      if (!config?.verifyEnabled) {
        return interaction.reply({ content: "❌ Xác minh đã bị tắt.", ephemeral: true });
      }
      const unverifiedRoleId = config.unverifiedRoleId;
      if (!unverifiedRoleId) {
        return interaction.reply({ content: "❌ Chưa cấu hình role xác minh.", ephemeral: true });
      }
      const member = guild.members.cache.get(interaction.user.id) || await guild.members.fetch(interaction.user.id).catch(() => null);
      if (!member) {
        return interaction.reply({ content: "❌ Không tìm thấy thành viên.", ephemeral: true });
      }
      if (!member.roles.cache.has(unverifiedRoleId)) {
        return interaction.reply({ content: "✅ Bạn đã xác minh rồi!", ephemeral: true });
      }
      // Tạo mã captcha và gửi DM
      const code = genCaptcha();
      setCode(guild.id, interaction.user.id, code);
      try {
        const dmEmbed = new EmbedBuilder()
          .setColor(Colors.Blue)
          .setTitle("🔑 Mã xác minh")
          .setDescription(`Mã xác minh của bạn trong **${guild.name}** là:`)
          .addFields({ name: "Mã", value: `||${code}||`, inline: true })
          .setFooter({ text: "Mã hết hạn trong 5 phút. Nhập mã trong kênh xác minh để hoàn tất." });
        await member.send({ embeds: [dmEmbed] });
        return interaction.reply({
          content: "✅ Đã gửi mã xác minh qua DM! Hãy kiểm tra tin nhắn trực tiếp và nhập mã trong kênh xác minh.",
          ephemeral: true,
        });
      } catch {
        return interaction.reply({
          content: '❌ Không thể gửi DM — hãy bật "cho phép tin nhắn trực tiếp" từ thành viên server rồi thử lại.',
          ephemeral: true,
        });
      }
    }
    if (interaction.customId === "verify_confirm") {
      const guild = interaction.guild;
      if (!guild) return;
      const config = await store.getConfig(guild.id);
      if (!config?.verifyEnabled) {
        return interaction.reply({ content: "❌ Xác minh đã bị tắt.", ephemeral: true });
      }
      const unverifiedRoleId = config.unverifiedRoleId;
      const verifiedRoleId = config.verifiedRoleId;
      if (!unverifiedRoleId || !verifiedRoleId) {
        return interaction.reply({ content: "❌ Chưa cấu hình role xác minh.", ephemeral: true });
      }
      const member = guild.members.cache.get(interaction.user.id) || await guild.members.fetch(interaction.user.id).catch(() => null);
      if (!member) {
        return interaction.reply({ content: "❌ Không tìm thấy thành viên.", ephemeral: true });
      }
      try {
        // === ALT DETECTION AT VERIFY GATE (Double Counter style) ===
        // Re-run alt analysis at verify time for defense-in-depth.
        // The guild member cache may have changed since join, so results
        // can differ — that's acceptable. If punishment fails (e.g. missing
        // permissions), we fail-open and allow verify instead of leaving
        // the user stuck in limbo.
        let altBanned = false;
        if (config.altDetectionEnabled) {
          try {
            const analysis = await analyzeNewMember(member, config, (guildId) => store.getConfig(guildId), store);
            const maxRisk = config.altMaxRiskScore ?? 70;
            if (analysis.riskScore >= maxRisk && analysis.action !== "pass") {
              // Execute punishment instead of verifying
              const punishResult = await executePunishment(member, analysis, config);

              // FIX: Fail-open — if punishment failed, allow verify anyway
              // instead of leaving user stuck (can't verify, can't be punished)
              if (!punishResult.executed) {
                console.log(`[verify:alt] ${guild.name}/${member.user.username} — punish FAILED (${punishResult.reason}), allowing verify (fail-open)`);
                // Fall through to normal verify flow
              } else {
                altBanned = true;

                // Đánh dấu đã bị phạt để lần join sau đối chiếu (evasion detect).
                await store.client
                  .mutation("altDetection:markJoinPunished", {
                    guildId: guild.id,
                    userId: member.id,
                    action: punishResult.action,
                  })
                  .catch(() => {});

                // Reply to user with reason
                await interaction.reply({
                  content: `❌ **Xác minh bị từ chối.** Tài khoản của bạn được đánh giá là có rủi ro cao (**${analysis.riskScore}/100**). Đã xử lý: ${punishResult.action}`,
                  ephemeral: true,
                }).catch(() => {});

                // Log to mod channel
                const { sendLog, logEmbed } = require("../util");
                const embed = buildRiskEmbed(member, analysis, punishResult);
                embed.setTitle("🚫 Alt Detected at Verify Gate");
                embed.setDescription(
                  `<@${member.id}> tried to verify but was blocked as alt account.\n\n` +
                  `**Risk Score:** ${analysis.riskScore}/100\n` +
                  `**Factors:** ${analysis.riskFactors.join(", ")}`,
                );
                await sendLog(guild, config, embed).catch(() => {});

                // Record as antinuke event
                await store.client.mutation("bot_writes:botRecordAntinukeEvent", {
                  guildId: guild.id,
                  module: "altDetection",
                  executorId: member.id,
                  executorName: member.user.username,
                  action: `${punishResult.action} at verify gate — risk: ${analysis.riskScore}/100 — ${analysis.riskFactors.join(", ")}`,
                  count: 1,
                  windowSeconds: 60,
                  threshold: 1,
                  punish: analysis.action,
                }).catch(() => {});

                console.log(`[verify:alt] ${guild.name}/${member.user.username} BLOCKED at verify — risk=${analysis.riskScore} action=${punishResult.action}`);
                return;
              }
            }
          } catch (e) {
            console.error(`[verify:alt] ${guild.id}:`, e.message);
            // If alt detection fails, still allow verify (fail-open for UX)
          }
        }

        // Normal verify flow
        if (member.roles.cache.has(unverifiedRoleId)) {
          await member.roles.remove(unverifiedRoleId, "Xác minh thành công");
        }
        if (!member.roles.cache.has(verifiedRoleId)) {
          await member.roles.add(verifiedRoleId, "Xác minh thành công");
        }
        await interaction.reply({ content: "✅ Đã xác minh thành công! Chào mừng bạn đến với server.", ephemeral: true });
        // Gửi DM chào mừng nếu bật
        if (config.verifyWelcomeEnabled) {
          try {
            const title = config.verifyWelcomeTitle || "🌸 Chào mừng bạn!";
            let description = config.verifyWelcomeDescription || `Chào mừng bạn đến với **${guild.name}**! Bạn đã xác minh thành công.`;
            description = description.replace(/{user}/g, `<@${member.id}>`).replace(/{server}/g, guild.name);
            const colorHex = config.verifyWelcomeColor || "#f2629e";
            const colorInt = parseInt(colorHex.replace("#", ""), 16) || 0xf2629e;
            const welcomeEmbed = new EmbedBuilder()
              .setTitle(title)
              .setDescription(description)
              .setColor(colorInt)
              .setThumbnail(guild.iconURL({ size: 256 }) || null)
              .setFooter({ text: guild.name, iconURL: guild.iconURL({ size: 64 }) || undefined });
            await member.send({ embeds: [welcomeEmbed] }).catch(() => {});
          } catch (e) {
            // member có thể tắt DM — bỏ qua im lặng
          }
        }
      } catch (e) {
        console.error(`[verify:button] ${guild.id}:`, e.message);
        if (!interaction.replied) {
          await interaction.reply({ content: `❌ Lỗi xác minh: ${e.message}`, ephemeral: true }).catch(() => {});
        }
      }
      return;
    }
    return;
  }

  if (!interaction.isChatInputCommand()) return;

  const name = interaction.commandName;
  const guild = interaction.guild;
  if (!guild) {
    return interaction.reply({ content: "Lệnh này chỉ hoạt động trong server.", ephemeral: true });
  }

  switch (name) {
    case "report": {
      // Báo cáo tình hình: AI quét hàng trăm tin nhắn + dữ liệu phạt 24h, công
      // bố kết quả cho server (mọi thành viên đều được dùng).
      return reportInteractive(client, store, interaction);
    }

    case "ping": {
      const ws = Math.round(client.ws.ping);
      return interaction.reply({ content: `🏓 Pong! **${ws}ms** (WebSocket)`, ephemeral: true });
    }

    case "help": {
      const embed = new EmbedBuilder()
        .setColor(Colors.Aqua)
        .setTitle("🧭 Lệnh của Protogon")
        .setDescription(
          [
            "**Auto Reply** — `/autoreply add` tạo rule từ khóa hoặc @mention, `/autoreply list`, `/autoreply remove`",
            "**Chống nuke** — `/antinuke status`, `/antinuke on|off`, `/antinuke module`, `/antinuke unlock`, `/antinuke lockdown`",
            "**Lọc nội dung** — module \`badword\`, \`invite\`, \`attachment\`, \`mention\` (bật tắt trong `/antinuke module`) · `/badword add|remove|list` · `/heat status`",
            "**Mod tools** — `/mod timeout @user 10m [lý do]`, `/mod untimeout`, `/mod kick`, `/mod ban`, `/mod unban`, `/mod unwarn`, `/mod purge` (ghi log lý do + người thực hiện)",
            "**Giveaway** — `/giveaway start <tên> <giải thưởng> <thời lượng>`, `/giveaway list`, `/giveaway end`",
            "**Reaction Role** — `/reactionrole create <kênh> <tên> <cặp emoji:role>`, `/reactionrole add`, `/reactionrole edit`, `/reactionrole remove`, `/reactionrole delete`",
            "**Backup server** — `/backup now` (tạo + đẩy GitHub chủ bot), `/backup list`, `/backup restore <số>`, `/backup auto <2-30>` (tự động định kỳ) — phòng khi server bị nuke phá sập",
            "**Báo cáo AI** — `/report [ghi chú]`: AI đọc hàng trăm tin nhắn gần đây + dữ liệu phạt 24h → báo cáo raid/nuke hoặc bot phạt nhầm, công bố cho server",
            "**Xác minh** — `/verify setup` (kênh + role), `/verify toggle`",
            "**Cấu hình** — `/setup log-channel`, `/setup mod-role`, `/setup admin-role`, `/prefix set`",
            "**Khác** — `/ping`",
          ].join("\n"),
        );
      return interaction.reply({ embeds: [embed], ephemeral: true });
    }

    case "prefix": {
      const set = interaction.options.getString("set");
      const config = await store.getConfig(guild.id);
      const current = config?.prefix || "!";
      if (!set) {
        return interaction.reply({ content: `Prefix hiện tại: \`${current}\``, ephemeral: true });
      }
      if (!canManageGuild(interaction.member)) return needPerm(interaction);
      if (!/^[!^$#&%]{1,3}$/.test(set)) {
        return interaction.reply({
          content: "Prefix phải là 1-3 ký tự đặc biệt (ví dụ: `!`, `^`).",
          ephemeral: true,
        });
      }
      await store.client.mutation("bot_writes:botUpdateSettings", { guildId: guild.id, prefix: set });
      store.invalidate(guild.id);
      return interaction.reply({
        content: `✅ Đã đổi prefix thành \`${set}\`. Lệnh text: \`${set}help\``,
        ephemeral: true,
      });
    }

    case "autoreply": {
      const sub = interaction.options.getSubcommand();
      const config = await store.getConfig(guild.id);

      if (sub === "list") {
        const rules = config?.autoReplies || [];
        if (rules.length === 0) {
          return interaction.reply({ content: "Chưa có rule auto reply nào.", ephemeral: true });
        }
        const lines = rules.map(
          (r) =>
            `• **${r.name}** — ${r.triggerType === "mention" ? "@mention" : r.keywords.join(", ")} — ${r.enabled ? "✅" : "⏸️"}`,
        );
        const embed = new EmbedBuilder()
          .setColor(Colors.Aqua)
          .setTitle(`📋 Auto reply (${rules.length})`)
          .setDescription(lines.join("\n").slice(0, 4000));
        return interaction.reply({ embeds: [embed], ephemeral: true });
      }

      // Mod/Admin (Manage Guild) hoặc role Mod/Admin được cấu hình qua /setup.
      if (!canManageWithConfig(interaction.member, config)) return needPerm(interaction);

      if (sub === "add") {
        const name = interaction.options.getString("name", true);
        const trigger = interaction.options.getString("trigger", true);
        const response = interaction.options.getString("response", true);
        const keywordsRaw = interaction.options.getString("keywords") ?? "";
        const cooldown = interaction.options.getInteger("cooldown") ?? 30;
        const payload = {
          guildId: guild.id,
          name,
          triggerType: trigger === "mention" ? "mention" : "keyword",
          keywords: keywordsRaw.split(",").map((k) => k.trim()).filter(Boolean),
          response,
          channels: [],
          cooldownSeconds: Math.max(0, cooldown),
          enabled: true,
        };
        if (payload.triggerType === "keyword" && payload.keywords.length === 0) {
          return interaction.reply({
            content: "Với loại `keyword` bạn cần nhập từ khóa (phân cách bằng dấu phẩy).",
            ephemeral: true,
          });
        }
        try {
          await store.client.mutation("bot_writes:botAutoReplyUpsert", payload);
        } catch (err) {
          return interaction.reply({ content: `❌ ${err.message}`, ephemeral: true });
        }
        store.invalidate(guild.id);
        return interaction.reply({
          content: `✅ Đã lưu rule \`${name}\` (thêm mới hoặc cập nhật) — bot trả lời: "${response.slice(0, 80)}${response.length > 80 ? "…" : ""}"`,
          ephemeral: true,
        });
      }

      if (sub === "remove") {
        const name = interaction.options.getString("name", true);
        await store.client.mutation("bot_writes:botAutoReplyRemove", {
          guildId: guild.id,
          name,
        });
        store.invalidate(guild.id);
        return interaction.reply({
          content: `✅ Đã xóa rule \`${name}\`.`,
          ephemeral: true,
        });
      }

      if (sub === "edit") {
        const name = interaction.options.getString("name", true);
        const response = interaction.options.getString("response");
        const cooldown = interaction.options.getInteger("cooldown");
        const rule = (config?.autoReplies || []).find((r) => r.name === name);
        if (!rule) {
          return interaction.reply({
            content: `Không tìm thấy rule \`${name}\`. Dùng \`/autoreply list\` để xem danh sách.`,
            ephemeral: true,
          });
        }
        await store.client.mutation("bot_writes:botAutoReplyUpsert", {
          guildId: guild.id,
          name,
          triggerType: rule.triggerType,
          keywords: rule.keywords,
          response: response ?? rule.response,
          channels: rule.channels || [],
          cooldownSeconds: cooldown !== null ? Math.max(0, cooldown) : rule.cooldownSeconds,
          enabled: rule.enabled,
        });
        store.invalidate(guild.id);
        return interaction.reply({
          content: `✅ Đã cập nhật rule \`${name}\`.`,
          ephemeral: true,
        });
      }
      return;
    }

    case "badword": {
      const sub = interaction.options.getSubcommand();
      const config = await store.getConfig(guild.id);
      const words = [...(config?.badWords || [])];

      if (sub === "list") {
        if (words.length === 0) {
          return interaction.reply({ content: "Danh sách từ ngữ xấu đang trống — dùng `/badword add` hoặc dashboard để thêm.", ephemeral: true });
        }
        const embed = new EmbedBuilder()
          .setColor(Colors.Aqua)
          .setTitle(`📋 Danh sách từ ngữ xấu (${words.length})`)
          .setDescription(words.map((w) => `\`${w}\``).join(", ").slice(0, 4000));
        return interaction.reply({ embeds: [embed], ephemeral: true });
      }

      if (!canManageGuild(interaction.member)) return needPerm(interaction);

      if (sub === "add") {
        const word = interaction.options.getString("word", true).trim().toLowerCase();
        if (!word) return interaction.reply({ content: "Từ ngữ không được để trống.", ephemeral: true });
        if (word.length > 40) {
          return interaction.reply({ content: "Từ ngữ tối đa 40 ký tự.", ephemeral: true });
        }
        if (words.includes(word)) {
          return interaction.reply({ content: `\`${word}\` đã có trong danh sách.`, ephemeral: true });
        }
        if (words.length >= 100) {
          return interaction.reply({ content: "Danh sách đã đạt tối đa 100 từ.", ephemeral: true });
        }
        words.push(word);
        await store.client.mutation("bot_writes:botUpdateSettings", {
          guildId: guild.id,
          badWords: words,
        });
        store.invalidate(guild.id);
        return interaction.reply({
          content: `✅ Đã thêm \`${word}\` vào danh sách từ ngữ xấu (${words.length} từ).`,
          ephemeral: true,
        });
      }

      if (sub === "remove") {
        const word = interaction.options.getString("word", true).trim().toLowerCase();
        const next = words.filter((w) => w !== word);
        if (next.length === words.length) {
          return interaction.reply({ content: `Không tìm thấy \`${word}\` trong danh sách.`, ephemeral: true });
        }
        await store.client.mutation("bot_writes:botUpdateSettings", {
          guildId: guild.id,
          badWords: next,
        });
        store.invalidate(guild.id);
        return interaction.reply({
          content: `✅ Đã xóa \`${word}\` khỏi danh sách từ ngữ xấu.`,
          ephemeral: true,
        });
      }
      return;
    }

    case "heat": {
      const config = await store.getConfig(guild.id);
      const s = {
        enabled: config?.heatEnabled !== false,
        decayPerMin: config?.heatDecayPerMin ?? 3,
        warnAt: config?.heatWarnAt ?? 25,
        timeoutAt: config?.heatTimeoutAt ?? 40,
        kickAt: config?.heatKickAt ?? 70,
        banAt: config?.heatBanAt ?? 90,
        repeatMultiplier: config?.heatRepeatMultiplier ?? 2,
        repeatWindowMin: config?.heatRepeatWindowMin ?? 30,
        warnStrikeLimit: config?.warnStrikeLimit ?? 3,
        warnStrikeWindowMin: config?.warnStrikeWindowMin ?? 60,
        warnStrikePunish: config?.warnStrikePunish ?? "timeout",
      };
      const top = config?.heatStates || [];
      const safety = config?.safetyPercent ?? 100;
      const tier = (heat) => (heat >= s.banAt ? "🚫 Ban" : heat >= s.kickAt ? "👢 Kick" : heat >= s.timeoutAt ? "⏸️ Tạm khóa" : "⚠️ Theo dõi");
      const embed = new EmbedBuilder()
        .setColor(safety >= 70 ? Colors.Green : safety >= 40 ? Colors.Yellow : Colors.Red)
        .setTitle(`🌡️ Nhiệt độ vi phạm: ${safety}% an toàn`)
        .setDescription(
          [
            s.enabled
              ? `Hệ thống nhiệt **đang bật** — giảm ${s.decayPerMin} điểm/phút, tái phạm tăng **x${s.repeatMultiplier}** trong ${s.repeatWindowMin} phút.`
              : `Hệ thống nhiệt **đang tắt**.`,
            `Ngưỡng: cảnh báo **${s.warnAt}** · tạm khóa **${s.timeoutAt}** · kick **${s.kickAt}** · ban **${s.banAt}** (tối đa 100).`,
            s.warnStrikeLimit
              ? `Warn tích lũy: **${s.warnStrikeLimit}** lần trong ${s.warnStrikeWindowMin} phút → **${s.warnStrikePunish}**.`
              : `Warn tích lũy: **đang tắt**.`,
          ].join("\n"),
        );
      if (top.length > 0) {
        embed.addFields({
          name: "Thành viên nóng nhất",
          value: top
            .slice(0, 10)
            .map((h) => `<@${h.userId}> — **${h.heat}/100** — ${tier(h.heat)}`)
            .join("\n")
            .slice(0, 1024),
        });
      } else {
        embed.addFields({ name: "Thành viên nóng nhất", value: "Chưa có vi phạm nào — server rất an toàn 🎉" });
      }
      return interaction.reply({ embeds: [embed], ephemeral: true });
    }

    case "antinuke": {
      const sub = interaction.options.getSubcommand();

      if (sub === "status") {
        const config = await store.getConfig(guild.id);
        const modules = config?.modules || [];
        const lines = modules.map(
          (m) => `${m.enabled ? "✅" : "⏸️"} \`${m.module}\` — ${m.threshold} lần/${m.windowSeconds}s — ${m.punish}`,
        );
        const embed = new EmbedBuilder()
          .setColor(config?.antinukeEnabled ? Colors.Green : Colors.Red)
          .setTitle(`🛡️ Chống nuke: ${config?.antinukeEnabled ? "ĐANG BẬT" : "ĐÃ TẮT"}`)
          .setDescription(lines.join("\n") || "Chưa có module nào.");
        return interaction.reply({ embeds: [embed], ephemeral: true });
      }

      if (!canManageGuild(interaction.member) && !isAdmin(interaction.member)) return needPerm(interaction);

      if (sub === "unlock") {
        if (!isLocked(guild.id)) {
          const config = await store.getConfig(guild.id);
          if (!config?.lockdownUntil || config.lockdownUntil <= Date.now()) {
            return interaction.reply({
              content: "Server hiện không ở trạng thái khóa kênh.",
              ephemeral: true,
            });
          }
          markLocked(guild.id);
        }
        const config = await store.getConfig(guild.id);
        await unlockGuild(client, guild, config, store);
        return interaction.reply({
          content: "🔓 Đã mở khóa kênh.",
          ephemeral: true,
        });
      }

      if (sub === "lockdown") {
        const value = interaction.options.getString("value", true);
        if (!["on", "off"].includes(value)) {
          return interaction.reply({ content: "Giá trị phải là on hoặc off.", ephemeral: true });
        }
        await store.client.mutation("bot_writes:botUpdateLockdown", {
          guildId: guild.id,
          enabled: value === "on",
        });
        store.invalidate(guild.id);
        return interaction.reply({
          content: value === "on"
            ? "✅ Khóa kênh tự động khi raid đã bật."
            : "✅ Khóa kênh tự động khi raid đã tắt.",
          ephemeral: true,
        });
      }

      if (sub === "on" || sub === "off") {
        await store.client.mutation("bot_writes:botSetAntinuke", {
          guildId: guild.id,
          enabled: sub === "on",
        });
        store.invalidate(guild.id);
        return interaction.reply({
          content: `✅ Đã ${sub === "on" ? "bật" : "tắt"} chống nuke.`,
          ephemeral: true,
        });
      }

      if (sub === "module") {
        const moduleName = interaction.options.getString("module", true);
        const value = interaction.options.getString("value", true);
        if (!MODULES.includes(moduleName) || !["on", "off"].includes(value)) {
          return interaction.reply({
            content: `Module phải thuộc: ${MODULES.join(", ")} và giá trị là on|off.`,
            ephemeral: true,
          });
        }
        await store.client.mutation("bot_writes:botModuleUpdate", {
          guildId: guild.id,
          module: moduleName,
          enabled: value === "on",
        });
        store.invalidate(guild.id);
        return interaction.reply({
          content: `✅ Module \`${moduleName}\` đã ${value === "on" ? "bật" : "tắt"}.`,
          ephemeral: true,
        });
      }
      return;
    }

    case "mod": {
      const sub = interaction.options.getSubcommand();
      const config = await store.getConfig(guild.id);
      if (!canMod(interaction, config)) return needPerm(interaction);

      if (sub === "timeout") {
        const target = interaction.options.getMember("user");
        const minutes = parseDuration(interaction.options.getString("duration", true));
        const reason = interaction.options.getString("reason") || undefined;
        if (!target) {
          return interaction.reply({ content: "Không tìm thấy thành viên đó.", ephemeral: true });
        }
        if (!minutes) {
          return interaction.reply({
            content: "Thời lượng không hợp lệ (ví dụ: `10m`, `2h`, `1d`). Tối đa 7 ngày.",
            ephemeral: true,
          });
        }
        try {
          const out = await timeoutMember({
            guild,
            member: target,
            executor: interaction.user,
            minutes,
            reason,
            guildConfig: config,
            store,
          });
          return interaction.reply({ content: `✅ ${out}`, ephemeral: true });
        } catch (e) {
          return interaction.reply({ content: `❌ Không thể timeout: ${e.message}`, ephemeral: true });
        }
      }

      if (sub === "kick") {
        const target = interaction.options.getMember("user");
        const reason = interaction.options.getString("reason") || undefined;
        if (!target) {
          return interaction.reply({ content: "Không tìm thấy thành viên đó.", ephemeral: true });
        }
        try {
          const out = await kickMember({
            guild,
            member: target,
            executor: interaction.user,
            reason,
            guildConfig: config,
            store,
          });
          return interaction.reply({ content: `✅ ${out}`, ephemeral: true });
        } catch (e) {
          return interaction.reply({ content: `❌ Không thể kick: ${e.message}`, ephemeral: true });
        }
      }

      if (sub === "ban") {
        const target = interaction.options.getMember("user");
        const reason = interaction.options.getString("reason") || undefined;
        const deleteDays = Math.max(0, Math.min(7, interaction.options.getInteger("delete_days") ?? 0));
        if (!target) {
          return interaction.reply({ content: "Không tìm thấy thành viên đó.", ephemeral: true });
        }
        try {
          const out = await banMember({
            guild,
            member: target,
            executor: interaction.user,
            reason,
            deleteDays,
            guildConfig: config,
            store,
          });
          return interaction.reply({ content: `✅ ${out}`, ephemeral: true });
        } catch (e) {
          return interaction.reply({ content: `❌ Không thể ban: ${e.message}`, ephemeral: true });
        }
      }

      if (sub === "purge") {
        const count = interaction.options.getInteger("count", true);
        try {
          const out = await purgeChannel(interaction.channel, count, interaction.user, config, store);
          return interaction.reply({ content: `✅ ${out}`, ephemeral: true });
        } catch (e) {
          return interaction.reply({ content: `❌ Không thể purge: ${e.message}`, ephemeral: true });
        }
      }

      if (sub === "untimeout") {
        const target = interaction.options.getMember("user");
        const reason = interaction.options.getString("reason") || undefined;
        if (!target) {
          return interaction.reply({ content: "Không tìm thấy thành viên đó.", ephemeral: true });
        }
        try {
          const out = await untimeoutMember({
            guild,
            member: target,
            executor: interaction.user,
            reason,
            guildConfig: config,
            store,
          });
          return interaction.reply({ content: `✅ ${out}`, ephemeral: true });
        } catch (e) {
          return interaction.reply({ content: `❌ Không thể gỡ timeout: ${e.message}`, ephemeral: true });
        }
      }

      if (sub === "unban") {
        const target = interaction.options.getUser("user");
        const reason = interaction.options.getString("reason") || undefined;
        if (!target) {
          return interaction.reply({ content: "Không tìm thấy người dùng đó.", ephemeral: true });
        }
        try {
          const out = await unbanMember({
            guild,
            userId: target.id,
            executor: interaction.user,
            reason,
            guildConfig: config,
            store,
          });
          return interaction.reply({ content: `✅ ${out}`, ephemeral: true });
        } catch (e) {
          return interaction.reply({ content: `❌ Không thể gỡ ban: ${e.message}`, ephemeral: true });
        }
      }

      if (sub === "unwarn") {
        const target = interaction.options.getUser("user");
        const reason = interaction.options.getString("reason") || undefined;
        if (!target) {
          return interaction.reply({ content: "Không tìm thấy người dùng đó.", ephemeral: true });
        }
        try {
          const out = await unwarnMember({
            guild,
            userId: target.id,
            heat,
            executor: interaction.user,
            reason,
            guildConfig: config,
            store,
          });
          return interaction.reply({ content: `✅ ${out}`, ephemeral: true });
        } catch (e) {
          return interaction.reply({ content: `❌ Không thể gỡ warn: ${e.message}`, ephemeral: true });
        }
      }
      return;
    }

    case "giveaway": {
      const sub = interaction.options.getSubcommand();
      const config = await store.getConfig(guild.id);

      if (sub === "list") {
        const giveaways = config?.giveaways || [];
        if (giveaways.length === 0) {
          return interaction.reply({ content: "Chưa có giveaway nào.", ephemeral: true });
        }
        const lines = giveaways
          .slice(0, 20)
          .map((g) => `${g.status === "active" ? "🎉" : "🏁"} **${g.title}** — ${g.entries?.length || 0} lượt tham gia`);
        const embed = new EmbedBuilder()
          .setColor(Colors.Aqua)
          .setTitle(`🎉 Giveaway (${giveaways.length})`)
          .setDescription(lines.join("\n").slice(0, 4000));
        return interaction.reply({ embeds: [embed], ephemeral: true });
      }

      if (!canMod(interaction, config)) return needPerm(interaction);

      if (sub === "start") {
        const title = interaction.options.getString("title", true);
        const prize = interaction.options.getString("prize", true);
        const minutes = parseDuration(interaction.options.getString("duration", true));
        const winnerCount = Math.max(1, Math.min(20, interaction.options.getInteger("winners") ?? 1));
        const prizeRole = interaction.options.getRole("prize_role");
        if (!minutes) {
          return interaction.reply({
            content: "Thời lượng không hợp lệ (ví dụ: `30m`, `2h`, `1d`).",
            ephemeral: true,
          });
        }
        try {
          await store.client.mutation("hidden:botCreateGiveaway", {
            guildId: guild.id,
            channelId: interaction.channel.id,
            title: title.slice(0, 100),
            prize: prize.slice(0, 2000),
            winnerCount,
            durationMinutes: minutes,
            dmWinners: true,
            prizeRoleId: prizeRole ? prizeRole.id : undefined,
          });
          store.invalidate(guild.id);
          return interaction.reply({
            content: `🎉 Đã tạo giveaway "${title}" tại ${interaction.channel} — bot gửi embed trong ~1 phút!`,
            ephemeral: true,
          });
        } catch (e) {
          return interaction.reply({ content: `❌ ${e.message}`, ephemeral: true });
        }
      }

      if (sub === "end") {
        const title = interaction.options.getString("title", true);
        const res = await store.client.mutation("hidden:botGiveawayEndNow", {
          guildId: guild.id,
          title,
        });
        store.invalidate(guild.id);
        return interaction.reply({
          content: res.ok
            ? `✅ Đã kết thúc giveaway "${title}" — bot chốt người thắng trong ~1 phút.`
            : `Không tìm thấy giveaway đang chạy tên "${title}".`,
          ephemeral: true,
        });
      }
      return;
    }

    case "reactionrole": {
      const sub = interaction.options.getSubcommand();
      const hidden = await store.client
        .query("hidden:getBotHidden", { guildId: guild.id })
        .catch(() => null);
      const panels = hidden?.panels || [];
      const findPanel = (name) =>
        panels.find((p) => p.label.toLowerCase() === String(name || "").trim().toLowerCase());

      if (sub === "list") {
        if (panels.length === 0) {
          return interaction.reply({
            content: "Chưa có bảng reaction role nào — dùng `/reactionrole create` hoặc dashboard.",
            ephemeral: true,
          });
        }
        const lines = panels.map((p) => {
          const ch = guild.channels.cache.get(p.channelId);
          return `• **${p.label}** — ${ch ? `#${ch.name}` : "kênh đã xóa"} — ${p.entries.length} cặp — ${p.enabled ? "✅" : "⏸️"}`;
        });
        const embed = new EmbedBuilder()
          .setColor(Colors.Aqua)
          .setTitle(`🎭 Reaction role (${panels.length})`)
          .setDescription(lines.join("\n").slice(0, 4000));
        return interaction.reply({ embeds: [embed], ephemeral: true });
      }

      if (!canManageGuild(interaction.member)) return needPerm(interaction);

      if (sub === "create") {
        const channel = interaction.options.getChannel("channel", true);
        const label = interaction.options.getString("label", true);
        const description = interaction.options.getString("description") || undefined;
        const thumbnail = interaction.options.getString("thumbnail") || undefined;
        const entries = parsePairs(interaction.options.getString("pairs", true), guild);
        if (!channel.isTextBased()) {
          return interaction.reply({ content: "Kênh phải là kênh văn bản.", ephemeral: true });
        }
        if (entries.length === 0) {
          return interaction.reply({
            content: "Cần ít nhất 1 cặp emoji:role hợp lệ, VD: `✅:123456789 ⭐:987654321`.",
            ephemeral: true,
          });
        }
        try {
          await store.client.mutation("hidden:botCreatePanel", {
            guildId: guild.id,
            channelId: channel.id,
            label,
            description,
            thumbnailUrl: thumbnail,
            entries,
          });
          store.invalidate(guild.id);
          return interaction.reply({
            content: `✅ Đã tạo bảng "${label}" tại ${channel} — bot gửi tin nhắn trong ~1 phút.`,
            ephemeral: true,
          });
        } catch (e) {
          return interaction.reply({ content: `❌ ${e.message}`, ephemeral: true });
        }
      }

      if (sub === "add") {
        const label = interaction.options.getString("label", true);
        const emoji = interaction.options.getString("emoji", true);
        const role = interaction.options.getRole("role", true);
        const panel = findPanel(label);
        if (!panel) {
          return interaction.reply({
            content: `Không tìm thấy bảng "${label}" — dùng \`/reactionrole list\`.`,
            ephemeral: true,
          });
        }
        if (panel.entries.some((e) => emojiKeyOf(e.emoji) === emojiKeyOf(emoji))) {
          return interaction.reply({ content: "Emoji này đã có trong bảng.", ephemeral: true });
        }
        try {
          await store.client.mutation("hidden:botUpdatePanel", {
            guildId: guild.id,
            panelId: panel._id,
            entries: [...panel.entries, { emoji, roleId: role.id }],
          });
          store.invalidate(guild.id);
          return interaction.reply({
            content: `✅ Đã thêm ${emoji} → ${role} vào bảng "${panel.label}" — bot gửi bảng mới trong ~1 phút.`,
            ephemeral: true,
          });
        } catch (e) {
          return interaction.reply({ content: `❌ ${e.message}`, ephemeral: true });
        }
      }

      if (sub === "remove") {
        const label = interaction.options.getString("label", true);
        const emoji = interaction.options.getString("emoji", true);
        const panel = findPanel(label);
        if (!panel) {
          return interaction.reply({
            content: `Không tìm thấy bảng "${label}" — dùng \`/reactionrole list\`.`,
            ephemeral: true,
          });
        }
        const next = panel.entries.filter((e) => emojiKeyOf(e.emoji) !== emojiKeyOf(emoji));
        if (next.length === panel.entries.length) {
          return interaction.reply({ content: "Không tìm thấy emoji này trong bảng.", ephemeral: true });
        }
        try {
          await store.client.mutation("hidden:botUpdatePanel", {
            guildId: guild.id,
            panelId: panel._id,
            entries: next,
          });
          store.invalidate(guild.id);
          return interaction.reply({
            content: `✅ Đã gỡ ${emoji} khỏi bảng "${panel.label}" — bot gửi bảng mới trong ~1 phút.`,
            ephemeral: true,
          });
        } catch (e) {
          return interaction.reply({ content: `❌ ${e.message}`, ephemeral: true });
        }
      }

      if (sub === "edit") {
        const label = interaction.options.getString("label", true);
        const panel = findPanel(label);
        if (!panel) {
          return interaction.reply({
            content: `Không tìm thấy bảng "${label}" — dùng \`/reactionrole list\`.`,
            ephemeral: true,
          });
        }
        const patch = { guildId: guild.id, panelId: panel._id };
        const newLabel = interaction.options.getString("new_label");
        if (newLabel) patch.label = newLabel;
        const description = interaction.options.getString("description");
        if (description !== null) patch.description = description === "-" ? null : description;
        const thumbnail = interaction.options.getString("thumbnail");
        if (thumbnail !== null) patch.thumbnailUrl = thumbnail === "-" ? null : thumbnail;
        if (!("label" in patch) && !("description" in patch) && !("thumbnailUrl" in patch)) {
          return interaction.reply({
            content: "Cần cung cấp ít nhất một trường: new_label / description / thumbnail.",
            ephemeral: true,
          });
        }
        try {
          await store.client.mutation("hidden:botUpdatePanel", patch);
          store.invalidate(guild.id);
          return interaction.reply({
            content: `✅ Đã cập nhật bảng "${panel.label}" — bot gửi bảng mới trong ~1 phút.`,
            ephemeral: true,
          });
        } catch (e) {
          return interaction.reply({ content: `❌ ${e.message}`, ephemeral: true });
        }
      }

      if (sub === "delete") {
        const label = interaction.options.getString("label", true);
        const panel = findPanel(label);
        if (!panel) {
          return interaction.reply({
            content: `Không tìm thấy bảng "${label}" — dùng \`/reactionrole list\`.`,
            ephemeral: true,
          });
        }
        try {
          await store.client.mutation("hidden:botDeletePanel", {
            guildId: guild.id,
            panelId: panel._id,
          });
          store.invalidate(guild.id);
          return interaction.reply({
            content: `✅ Đã xóa bảng "${panel.label}" (tin nhắn cũ trong Discord vẫn còn).`,
            ephemeral: true,
          });
        } catch (e) {
          return interaction.reply({ content: `❌ ${e.message}`, ephemeral: true });
        }
      }
      return;
    }

    case "backup": {
      const sub = interaction.options.getSubcommand();
      const guildId = guild.id;

      if (sub === "list") {
        const list = await store.client
          .query("backup:listGuild", { guildId })
          .catch(() => null);
        if (!list || list.length === 0) {
          return interaction.reply({
            content: "Chưa có backup nào của server này — dùng `/backup now` để tạo bản đầu tiên.",
            ephemeral: true,
          });
        }
        const lines = list.map(
          (b, i) =>
            `${i + 1}. **${b.guildName}** — ${new Date(b.createdAt).toLocaleString("vi-VN")} — ${b.roleCount} role · ${b.channelCount} kênh${b.pushedToGithub ? " · ☁️ GitHub" : ""}`,
        );
        const embed = new EmbedBuilder()
          .setColor(Colors.Blurple)
          .setTitle(`💾 Backup của server (${list.length})`)
          .setDescription(lines.join("\n"))
          .setFooter({ text: "Khôi phục: /backup restore <số thứ tự>" });
        return interaction.reply({ embeds: [embed], ephemeral: true });
      }

      if (sub === "restore") {
        if (!canManageGuild(interaction.member)) return needPerm(interaction);
        const idx = interaction.options.getInteger("index", true);
        const list = await store.client
          .query("backup:listGuild", { guildId })
          .catch(() => null);
        const backup = list && list[idx - 1];
        if (!backup) {
          return interaction.reply({
            content: `Không tìm thấy backup số ${idx} — chạy /backup list để xem danh sách.`,
            ephemeral: true,
          });
        }
        try {
          await store.client.mutation("bot_writes:botSetRestoreRequest", {
            guildId,
            backupId: backup._id,
          });
          store.invalidate(guildId);
          return interaction.reply({
            content: `✅ Đã yêu cầu khôi phục backup của **${backup.guildName}** (${backup.roleCount} role · ${backup.channelCount} kênh) — bot tạo lại cấu trúc trong ~1 phút.`,
            ephemeral: true,
          });
        } catch (e) {
          return interaction.reply({ content: `❌ ${e.message}`, ephemeral: true });
        }
      }

      if (sub === "auto") {
        if (!canManageGuild(interaction.member)) return needPerm(interaction);
        const days = interaction.options.getInteger("days", true);
        if (days !== 0 && (days < 2 || days > 30)) {
          return interaction.reply({
            content: "Số ngày phải từ 2 đến 30 (0 = tắt).",
            ephemeral: true,
          });
        }
        try {
          await store.client.mutation("bot_writes:botSetAutoBackup", { guildId, days });
          store.invalidate(guildId);
          return interaction.reply({
            content:
              days > 0
                ? `✅ Tự động backup mỗi **${days} ngày** — bot tự chụp + đẩy lên GitHub của chủ bot. Xem kết quả: /backup list`
                : "✅ Đã tắt tự động backup — bot chỉ backup khi bạn dùng lệnh hoặc trên dashboard.",
            ephemeral: true,
          });
        } catch (e) {
          return interaction.reply({ content: `❌ ${e.message}`, ephemeral: true });
        }
      }

      // /backup now — mặc định đẩy lên GitHub (token của chủ bot, dùng chung mọi server)
      if (!canManageGuild(interaction.member)) return needPerm(interaction);
      const github = interaction.options.getBoolean("github") ?? true;
      try {
        await store.client.mutation("bot_writes:botSetBackupRequest", {
          guildId,
          pushToGithub: github,
        });
        store.invalidate(guildId);
        return interaction.reply({
          content: github
            ? "✅ Đã yêu cầu tạo backup (đẩy lên GitHub của chủ bot) — bot thực hiện trong ~20 giây. Xem kết quả: `/backup list`"
            : "✅ Đã yêu cầu tạo backup (chỉ lưu trên Convex) — bot thực hiện trong ~20 giây. Xem kết quả: `/backup list`",
          ephemeral: true,
        });
      } catch (e) {
        return interaction.reply({ content: `❌ ${e.message}`, ephemeral: true });
      }
    }

    case "verify": {
      const sub = interaction.options.getSubcommand();
      if (!canManageGuild(interaction.member)) return needPerm(interaction);

      if (sub === "setup") {
        const channel = interaction.options.getChannel("channel", true);
        const unverifiedRole = interaction.options.getRole("unverified_role", true);
        const verifiedRole = interaction.options.getRole("verified_role", true);
        const method = interaction.options.getString("method") || "button";
        await store.client.mutation("bot_writes:botUpdateSettings", {
          guildId: guild.id,
          verifyEnabled: true,
          verifyMethod: method,
          verifyChannelId: channel.id,
          unverifiedRoleId: unverifiedRole.id,
          verifiedRoleId: verifiedRole.id,
        });
        store.invalidate(guild.id);
        try {
          const embed = new EmbedBuilder()
            .setColor(Colors.Blurple)
            .setTitle("✅ Xác minh thành viên")
            .setDescription(
              method === "captcha"
                ? "Nhấn nút bên dưới để nhận mã xác minh qua DM, sau đó nhập mã trong kênh này."
                : "Nhấn nút bên dưới để xác minh và vào server."
            );
          const row = new ActionRowBuilder();
          if (method === "captcha") {
            row.addComponents(
              new ButtonBuilder()
                .setCustomId("verify_request_captcha")
                .setLabel("Nhận mã xác minh 🔑")
                .setStyle(ButtonStyle.Primary),
            );
          } else {
            row.addComponents(
              new ButtonBuilder()
                .setCustomId("verify_confirm")
                .setLabel("Xác minh ✅")
                .setStyle(ButtonStyle.Success),
            );
          }
          await channel.send({ embeds: [embed], components: [row] });
        } catch (e) {
          console.error(`[verify:setup:send] ${guild.id}:`, e.message);
        }
        return interaction.reply({
          content: `✅ Đã thiết lập xác minh (${method === "captcha" ? "captcha" : "button"}): kênh ${channel}, role chưa xác minh ${unverifiedRole}, role đã xác minh ${verifiedRole}.`,
          ephemeral: true,
        });
      }

      if (sub === "toggle") {
        const value = interaction.options.getString("value", true);
        if (!["on", "off"].includes(value)) {
          return interaction.reply({ content: "Giá trị phải là on hoặc off.", ephemeral: true });
        }
        await store.client.mutation("bot_writes:botUpdateSettings", {
          guildId: guild.id,
          verifyEnabled: value === "on",
        });
        store.invalidate(guild.id);
        return interaction.reply({
          content: `✅ Đã ${value === "on" ? "bật" : "tắt"} xác minh thành viên.`,
          ephemeral: true,
        });
      }

      if (sub === "method") {
        const type = interaction.options.getString("type", true);
        if (!["button", "captcha"].includes(type)) {
          return interaction.reply({ content: "Phương thức phải là button hoặc captcha.", ephemeral: true });
        }
        await store.client.mutation("bot_writes:botUpdateSettings", {
          guildId: guild.id,
          verifyMethod: type,
        });
        store.invalidate(guild.id);
        return interaction.reply({
          content: `✅ Đã đổi phương thức xác minh thành **${type === "captcha" ? "captcha — nhập mã DM" : "button — bấm nút"}**.`,
          ephemeral: true,
        });
      }
      return;
    }

    case "setup": {
      if (!canManageGuild(interaction.member)) return needPerm(interaction);
      const sub = interaction.options.getSubcommand();

      if (sub === "log-channel") {
        const channel = interaction.options.getChannel("channel", true);
        await store.client.mutation("bot_writes:botUpdateSettings", {
          guildId: guild.id,
          logChannelId: channel.id,
        });
        store.invalidate(guild.id);
        return interaction.reply({
          content: `✅ Kênh log đã đặt là ${channel}.`,
          ephemeral: true,
        });
      }

      if (sub === "mod-role") {
        const role = interaction.options.getRole("role", true);
        const config = await store.getConfig(guild.id);
        const modRoles = [...new Set([...(config?.modRoles || []), role.id])];
        await store.client.mutation("bot_writes:botUpdateSettings", {
          guildId: guild.id,
          modRoles,
        });
        store.invalidate(guild.id);
        return interaction.reply({
          content: `✅ Role Mod đã thêm ${role}.`,
          ephemeral: true,
        });
      }

      if (sub === "admin-role") {
        const role = interaction.options.getRole("role", true);
        const config = await store.getConfig(guild.id);
        const adminRoles = [...new Set([...(config?.adminRoles || []), role.id])];
        await store.client.mutation("bot_writes:botUpdateSettings", {
          guildId: guild.id,
          adminRoles,
        });
        store.invalidate(guild.id);
        return interaction.reply({
          content: `✅ Role Admin đã thêm ${role}.`,
          ephemeral: true,
        });
      }
      return;
    }

    case "alt": {
      const sub = interaction.options.getSubcommand();
      const config = await store.getConfig(guild.id);
      if (!canManageGuild(interaction.member) && !isAdmin(interaction.member)) return needPerm(interaction);

      if (sub === "status") {
        const enabled = config?.altDetectionEnabled ?? false;
        const vpnMode = config?.altVpnMode ?? "off";
        const maxRisk = config?.altMaxRiskScore ?? 70;
        const minAge = config?.altMinAgeDays ?? 7;
        const punish = config?.altPunish ?? "kick";
        const embed = new EmbedBuilder()
          .setColor(enabled ? Colors.Green : Colors.Red)
          .setTitle("🔍 Alt Detection Status")
          .setDescription(
            [
              `**Phát hiện alt account:** ${enabled ? "✅ BẬT" : "⏸️ TẮT"}`,
              `**Chế độ VPN:** ${vpnMode === "strict" ? "🔒 Nghiêm ngặt" : vpnMode === "warn" ? "⚠️ Cảnh báo" : "⏸️ Tắt"}`,
              `**Ngưỡng rủi ro:** ${maxRisk}/100`,
              `**Tuổi tối thiểu:** ${minAge} ngày`,
              `**Hình phạt:** ${punish}`,
              `**Tương đồng username:** ≥${config?.altSimilarityThreshold ?? 70}%`,
              `**Cửa sổ join:** ${config?.altJoinWindowMinutes ?? 5} phút`,
            ].join("\n"),
          );
        return interaction.reply({ embeds: [embed], ephemeral: true });
      }

      if (sub === "on" || sub === "off") {
        await store.client.mutation("bot_writes:botUpdateSettings", {
          guildId: guild.id,
          altDetectionEnabled: sub === "on",
        });
        store.invalidate(guild.id);
        return interaction.reply({
          content: `✅ Đã ${sub === "on" ? "bật" : "tắt"} phát hiện alt account.`,
          ephemeral: true,
        });
      }

      if (sub === "punish") {
        const type = interaction.options.getString("type", true);
        if (!["kick", "ban", "timeout", "verify"].includes(type)) {
          return interaction.reply({ content: "Hình phạt phải là: kick, ban, timeout, hoặc verify.", ephemeral: true });
        }
        await store.client.mutation("bot_writes:botUpdateSettings", {
          guildId: guild.id,
          altPunish: type,
        });
        store.invalidate(guild.id);
        return interaction.reply({
          content: `✅ Hình phạt alt account đã đổi thành **${type}**.`,
          ephemeral: true,
        });
      }

      if (sub === "threshold") {
        const value = interaction.options.getInteger("value", true);
        if (value < 10 || value > 100) {
          return interaction.reply({ content: "Ngưỡng phải từ 10 đến 100.", ephemeral: true });
        }
        await store.client.mutation("bot_writes:botUpdateSettings", {
          guildId: guild.id,
          altMaxRiskScore: value,
        });
        store.invalidate(guild.id);
        return interaction.reply({
          content: `✅ Ngưỡng rủi ro đã đổi thành **${value}/100**.`,
          ephemeral: true,
        });
      }

      if (sub === "vpn") {
        const mode = interaction.options.getString("mode", true);
        if (!["strict", "warn", "off"].includes(mode)) {
          return interaction.reply({ content: "Chế độ VPN phải là: strict, warn, hoặc off.", ephemeral: true });
        }
        await store.client.mutation("bot_writes:botUpdateSettings", {
          guildId: guild.id,
          altVpnMode: mode,
          vpnBlockEnabled: mode === "strict",
        });
        store.invalidate(guild.id);
        return interaction.reply({
          content: `✅ Chế độ VPN đã đổi thành **${mode === "strict" ? "nghiêm ngặt" : mode === "warn" ? "cảnh báo" : "tắt"}**.`,
          ephemeral: true,
        });
      }
      return;
    }

    default:
      return interaction.reply({ content: "Lệnh chưa được hỗ trợ.", ephemeral: true });
  }
};
