const { EmbedBuilder, Colors, PermissionFlagsBits } = require("discord.js");

function hasPermission(member, permission) {
  if (!member || !member.permissions) return false;
  return member.permissions.has(permission);
}

function canManageGuild(member) {
  return hasPermission(member, PermissionFlagsBits.ManageGuild);
}

function isAdmin(member) {
  return hasPermission(member, PermissionFlagsBits.Administrator);
}

/**
 * Quản lý auto reply: quyền Manage Guild/Administrator, HOẶC có role Mod/Admin
 * đã được cấu hình qua /setup mod-role, /setup admin-role.
 */
function canManageWithConfig(member, config) {
  if (canManageGuild(member) || isAdmin(member)) return true;
  if (!config || !member) return false;
  const ids = [...(config.modRoles || []), ...(config.adminRoles || [])];
  return ids.some((id) => member.roles.cache.has(id));
}

/** Fill {user} / {username} placeholders in a response. */
function fillPlaceholders(text, author) {
  return text
    .replaceAll("{user}", `<@${author.id}>`)
    .replaceAll("{username}", author.username);
}

function logEmbed({ title, description, color = Colors.Red, fields = [], footer }) {
  const embed = new EmbedBuilder()
    .setColor(color)
    .setTitle(title)
    .setDescription(description)
    .setTimestamp();
  if (fields.length) embed.addFields(fields);
  if (footer) embed.setFooter({ text: footer });
  return embed;
}

/** Gửi embed tới một kênh. Trả về true nếu gửi thành công, false nếu kênh
 * không tồn tại / không phải kênh text / gửi thất bại (để caller fallback). */
async function sendToChannel(guild, channelId, embed) {
  if (!guild || !channelId) return false;
  try {
    const channel = await guild.channels.fetch(channelId);
    if (channel && channel.isTextBased()) {
      await channel.send({ embeds: [embed] });
      return true;
    }
  } catch {
    // log channel unavailable — ignore
  }
  return false;
}

/**
 * Gửi embed qua webhook tùy chỉnh (nếu guild có webhook khớp loại sự kiện).
 * Trả về true khi ÍT NHẤT 1 webhook nhận thành công — caller bỏ qua kênh thường.
 * Không có webhook / gửi thất bại → false để fallback kênh như cũ.
 */
async function deliverViaWebhooks(guild, eventType, embed) {
  if (!guild) return false;
  try {
    const hub = require("./webhookHub");
    const matched = await hub.matchFor(guild.id, eventType);
    if (matched.length === 0) return false;
    let sent = 0;
    for (const wh of matched) {
      try {
        await hub.send(wh, embed, { guildName: guild.name });
        sent++;
      } catch {
        // webhook hỏng (đã xóa / thiếu quyền) — thử webhook khác
      }
    }
    return sent > 0;
  } catch {
    return false;
  }
}

/**
 * Log chung — dành cho cảnh báo ANTI NUKE / RAID và sự kiện quan trọng.
 * Ưu tiên webhook loại "general"; không có thì gửi tới logChannelId.
 */
async function sendLog(guild, guildConfig, embed) {
  if (!guildConfig || !guildConfig.logChannelId) return;
  if (await deliverViaWebhooks(guild, "general", embed)) return;
  await sendToChannel(guild, guildConfig.logChannelId, embed);
}

/**
 * Log MODERATION (auto-mod + lệnh mod thủ công: ban/timeout/kick/warn + gỡ hình
 * phạt, purge, bot xóa tin nhắn) — GỘP CHUNG một kênh, kiểu Carl-bot. Gửi tới
 * punishNoticeChannelId (nếu có) → modLogChannelId → kênh log chung.
 * Fallback qua từng kênh: nếu kênh ưu tiên đã bị xóa/hỏng thì vẫn ghi được
 * (không để mất log case).
 */
async function sendModLog(guild, guildConfig, embed, preferChannelId) {
  if (!guildConfig) return false;
  // Webhook tùy chỉnh loại "mod" được ưu tiên hơn kênh thường.
  if (await deliverViaWebhooks(guild, "mod", embed)) return true;
  const candidates = [
    preferChannelId,
    guildConfig.modLogChannelId,
    guildConfig.logChannelId,
  ].filter(Boolean);
  for (const channelId of [...new Set(candidates)]) {
    if (await sendToChannel(guild, channelId, embed)) return true;
  }
  return false;
}

function mentionRoles(roleIds) {
  if (!roleIds || roleIds.length === 0) return "không có";
  return roleIds.map((id) => `<@&${id}>`).join(", ");
}

module.exports = {
  hasPermission,
  canManageGuild,
  isAdmin,
  canManageWithConfig,
  fillPlaceholders,
  logEmbed,
  sendLog,
  sendModLog,
  mentionRoles,
  Colors,
};
