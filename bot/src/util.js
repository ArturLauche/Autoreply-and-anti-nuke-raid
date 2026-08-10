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

async function sendLog(guild, guildConfig, embed) {
  if (!guildConfig || !guildConfig.logChannelId) return;
  try {
    const channel = await guild.channels.fetch(guildConfig.logChannelId);
    if (channel && channel.isTextBased()) {
      await channel.send({ embeds: [embed] });
    }
  } catch {
    // log channel unavailable — ignore
  }
}

function mentionRoles(roleIds) {
  if (!roleIds || roleIds.length === 0) return "không có";
  return roleIds.map((id) => `<@&${id}>`).join(", ");
}

module.exports = {
  hasPermission,
  canManageGuild,
  isAdmin,
  fillPlaceholders,
  logEmbed,
  sendLog,
  mentionRoles,
  Colors,
};
