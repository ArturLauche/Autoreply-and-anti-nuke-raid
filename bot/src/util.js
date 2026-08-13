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

async function sendToChannel(guild, channelId, embed) {
  if (!guild || !channelId) return;
  try {
    const channel = await guild.channels.fetch(channelId);
    if (channel && channel.isTextBased()) {
      await channel.send({ embeds: [embed] });
    }
  } catch {
    // log channel unavailable — ignore
  }
}

/**
 * Log chung — dành cho cảnh báo ANTI NUKE / RAID và sự kiện quan trọng.
 * Gửi tới logChannelId.
 */
async function sendLog(guild, guildConfig, embed) {
  if (!guildConfig || !guildConfig.logChannelId) return;
  await sendToChannel(guild, guildConfig.logChannelId, embed);
}

/**
 * Log AUTO-MOD nội dung (badword, invite, malware, mention, attachment, spam,
 * massMessage, blankNoise) — gửi tới autoModLogChannelId nếu đã đặt, ngược lại
 * rơi về kênh log chung (logChannelId).
 */
async function sendAutoModLog(guild, guildConfig, embed) {
  if (!guildConfig) return;
  const channelId = guildConfig.autoModLogChannelId || guildConfig.logChannelId;
  await sendToChannel(guild, channelId, embed);
}

/**
 * Log hành động mod THỦ CÔNG (ban/timeout/kick/warn + gỡ hình phạt, purge) tới
 * kênh modLogChannelId nếu đã đặt, ngược lại rơi về kênh log chung (logChannelId).
 */
async function sendModLog(guild, guildConfig, embed) {
  if (!guildConfig) return;
  const channelId = guildConfig.modLogChannelId || guildConfig.logChannelId;
  await sendToChannel(guild, channelId, embed);
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
  sendAutoModLog,
  sendModLog,
  mentionRoles,
  Colors,
};
