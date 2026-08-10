const { Colors, PermissionFlagsBits } = require("discord.js");
const { logEmbed, sendLog } = require("../util");
const { heatSettings, punishMember, choosePunish, heatSummary } = require("../heat");

const MODULE_LABELS = {
  badword: "Từ ngữ xấu",
  invite: "Link mời Discord",
  attachment: "Spam ảnh/file đính kèm",
};

const INVITE_RE = /(?:discord\.(?:gg|me)\/|discord(?:app)?\.com\/invite\/)[a-zA-Z0-9_-]+/gi;

function escapeRegex(str) {
  return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/** So khớp từ với ranh giới từ (không khớp "ass" trong "assassin"). */
function wordBoundaryRegex(word) {
  return new RegExp(`(^|[^\\p{L}\\p{N}])${escapeRegex(word)}([^\\p{L}\\p{N}]|$)`, "iu");
}

function isExempt(member, config) {
  if (!member) return false;
  if (member.id === member.guild.ownerId) return true;
  if (member.permissions.has(PermissionFlagsBits.Administrator)) return true;
  if ((config?.adminRoles || []).some((id) => member.roles.cache.has(id))) return true;
  if ((config?.modRoles || []).some((id) => member.roles.cache.has(id))) return true;
  return false;
}

/** Xử lý một vi phạm nội dung: xóa tin, phạt (tăng cấp theo nhiệt), ghi log. */
async function handleViolation(client, message, moduleCfg, config, heat, reason, detail) {
  const member = message.member;
  if (!member) return;

  const s = heatSettings(config);
  const heatRes = await heat.add(
    message.guild.id,
    message.author.id,
    message.author.username,
    moduleCfg.heat ?? 10,
    s,
  );
  const chosen = choosePunish(moduleCfg.punish || "warn", heatRes);
  const action = await punishMember(
    message.guild,
    member,
    chosen,
    reason,
    moduleCfg.timeoutSeconds,
  );

  await message.delete().catch(() => {});

  try {
    await heat.store.client.mutation("bot_writes:botRecordAntinukeEvent", {
      guildId: message.guild.id,
      module: moduleCfg.module,
      executorId: message.author.id,
      executorName: message.author.username,
      action: action + (heatRes ? ` (nhiệt ${Math.round(heatRes.heat)})` : ""),
      count: 1,
      windowSeconds: moduleCfg.windowSeconds || 10,
      threshold: moduleCfg.threshold || 1,
      punish: chosen,
    });
  } catch (e) {
    console.error("[filters:record]", e.message);
  }

  const embed = logEmbed({
    title: `🚨 Cảnh báo: ${MODULE_LABELS[moduleCfg.module] || moduleCfg.module}`,
    description: `${detail} — tin nhắn của <@${message.author.id}> đã bị xóa.`,
    color: Colors.Red,
    fields: [
      { name: "Thủ phạm", value: `<@${message.author.id}>`, inline: true },
      { name: "Xử lý", value: (action + heatSummary(heatRes)).slice(0, 1000), inline: true },
      { name: "Module", value: `\`${moduleCfg.module}\``, inline: true },
    ],
    footer: "Protogon Moderation",
  });
  await sendLog(message.guild, config, embed);
}

/**
 * Quét từng tin nhắn: chặn link mời Discord, từ ngữ xấu, spam ảnh/file.
 * Được gọi từ index.js trên sự kiện messageCreate.
 */
async function scanMessage(client, message, store, heat) {
  if (!message.guild || message.author.bot || message.channel.isDMBased?.()) return;
  const config = await store.getConfig(message.guild.id);
  if (!config || config.antinukeEnabled === false) return;
  const member = message.member;
  if (!member || isExempt(member, config)) return;

  const modules = config.modules || [];
  const inviteCfg = modules.find((m) => m.module === "invite");
  const badwordCfg = modules.find((m) => m.module === "badword");
  const attachmentCfg = modules.find((m) => m.module === "attachment");

  // 1) Link mời Discord
  if (inviteCfg?.enabled && message.content) {
    const match = message.content.match(INVITE_RE);
    if (match) {
      return handleViolation(
        client,
        message,
        inviteCfg,
        config,
        heat,
        `[Protogon] Chặn link mời Discord: ${match[0]}`,
        `Chứa link mời \`${match[0]}\``,
      );
    }
  }

  // 2) Từ ngữ xấu (danh sách tùy chỉnh trong cài đặt server)
  if (badwordCfg?.enabled && message.content && (config.badWords || []).length > 0) {
    const lower = message.content.toLowerCase();
    const bad = (config.badWords || []).find((w) => w && wordBoundaryRegex(w).test(lower));
    if (bad) {
      return handleViolation(
        client,
        message,
        badwordCfg,
        config,
        heat,
        `[Protogon] Từ ngữ xấu: "${bad}"`,
        `Chứa từ ngữ xấu \`${bad}\``,
      );
    }
  }

  // 3) Spam ảnh / file đính kèm (đếm tin có đính kèm trong cửa sổ)
  if (attachmentCfg?.enabled && message.attachments.size > 0) {
    const key = `${message.guild.id}:${message.author.id}`;
    const now = Date.now();
    const arr = attachmentBuckets.get(key) ?? [];
    arr.push(now);
    const cutoff = now - (attachmentCfg.windowSeconds || 10) * 1000;
    const fresh = arr.filter((t) => t >= cutoff);
    if (fresh.length < (attachmentCfg.threshold || 5)) {
      attachmentBuckets.set(key, fresh);
      return;
    }
    attachmentBuckets.delete(key);

    const s = heatSettings(config);
    const heatRes = await heat.add(
      message.guild.id,
      message.author.id,
      message.author.username,
      attachmentCfg.heat ?? 15,
      s,
    );
    const chosen = choosePunish(attachmentCfg.punish || "timeout", heatRes);
    const reason = `[Protogon] Spam ảnh/file: ${fresh.length} tin đính kèm trong ${attachmentCfg.windowSeconds || 10}s`;
    const action = await punishMember(
      message.guild,
      member,
      chosen,
      reason,
      attachmentCfg.timeoutSeconds,
    );
    await message.delete().catch(() => {});

    try {
      await heat.store.client.mutation("bot_writes:botRecordAntinukeEvent", {
        guildId: message.guild.id,
        module: "attachment",
        executorId: message.author.id,
        executorName: message.author.username,
        action: action + (heatRes ? ` (nhiệt ${Math.round(heatRes.heat)})` : ""),
        count: fresh.length,
        windowSeconds: attachmentCfg.windowSeconds || 10,
        threshold: attachmentCfg.threshold || 5,
        punish: chosen,
      });
    } catch (e) {
      console.error("[filters:record]", e.message);
    }

    const embed = logEmbed({
      title: "🚨 Cảnh báo: Spam ảnh/file đính kèm",
      description: `<@${message.author.id}> đã gửi **${fresh.length} tin có đính kèm** trong **${attachmentCfg.windowSeconds || 10} giây** (ngưỡng ${attachmentCfg.threshold || 5}).`,
      color: Colors.Red,
      fields: [
        { name: "Thủ phạm", value: `<@${message.author.id}>`, inline: true },
        { name: "Xử lý", value: (action + heatSummary(heatRes)).slice(0, 1000), inline: true },
        { name: "Module", value: "`attachment`", inline: true },
      ],
      footer: "Protogon Moderation",
    });
    await sendLog(message.guild, config, embed);
  }
}

// `${guildId}:${userId}` -> [timestamps của tin có đính kèm]
const attachmentBuckets = new Map();

module.exports = scanMessage;
module.exports.MODULE_LABELS = MODULE_LABELS;
