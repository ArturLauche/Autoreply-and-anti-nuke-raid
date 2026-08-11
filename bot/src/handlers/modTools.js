const { EmbedBuilder, Colors, PermissionFlagsBits, time } = require("discord.js");
const { canManageWithConfig, sendLog } = require("../util");

/** Phân tích chuỗi thời lượng: "10m", "2h", "1d", "30" (mặc định = phút). */
function parseDuration(input) {
  const m = /^(\d+)\s*([smhd]?)$/i.exec((input || "").trim());
  if (!m) return null;
  const n = parseInt(m[1], 10);
  if (!Number.isFinite(n) || n <= 0) return null;
  const unit = (m[2] || "m").toLowerCase();
  const minutes = unit === "s" ? Math.ceil(n / 60) : unit === "h" ? n * 60 : unit === "d" ? n * 1440 : n;
  if (minutes > 10080) return null; // tối đa 7 ngày
  return Math.max(1, minutes);
}

function formatDuration(minutes) {
  if (minutes >= 1440) return `${minutes / 1440} ngày`;
  if (minutes >= 60) return `${minutes / 60} giờ`;
  return `${minutes} phút`;
}

/** Kiểm tra quyền mod: Manage Guild / Administrator / role Mod-Admin đã cấu hình. */
function canMod(messageOrInteraction, config) {
  return canManageWithConfig(messageOrInteraction.member, config);
}

function needPerm(channel) {
  return channel.send("❌ Bạn cần quyền **Quản lý server** hoặc role **Mod/Admin** được cấu hình để dùng lệnh này.");
}

/** Ghi log hành động mod vào kênh log (kèm lý do + người thực hiện). */
async function logModAction(guild, guildConfig, { action, color, target, reason, extra = [] }) {
  const embed = new EmbedBuilder()
    .setColor(color)
    .setTitle(action)
    .setTimestamp()
    .addFields(
      { name: "Thành viên", value: target ? `${target} (\`${target.id}\`)` : "—", inline: true },
      ...extra,
      { name: "Lý do", value: reason || "Không có", inline: false },
    )
    .setFooter({ text: "Protogon · Công cụ Mod" });
  await sendLog(guild, guildConfig, embed);
}

async function timeoutMember({ guild, member, executor, minutes, reason, guildConfig }) {
  await member.timeout(minutes * 60_000, reason || undefined);
  await logModAction(guild, guildConfig, {
    action: "⏱️ Timeout",
    color: Colors.Orange,
    target: member.user,
    reason,
    extra: [
      { name: "Thời lượng", value: formatDuration(minutes), inline: true },
      { name: "Người thực hiện", value: `${executor} (\`${executor.id}\`)`, inline: true },
    ],
  });
  return `Đã timeout **${member.user.tag}** trong ${formatDuration(minutes)}${reason ? ` — Lý do: ${reason}` : ""}`;
}

async function kickMember({ guild, member, executor, reason, guildConfig }) {
  await member.kick(reason || undefined);
  await logModAction(guild, guildConfig, {
    action: "👢 Kick",
    color: Colors.Red,
    target: member.user,
    reason,
    extra: [{ name: "Người thực hiện", value: `${executor} (\`${executor.id}\`)`, inline: true }],
  });
  return `Đã kick **${member.user.tag}**${reason ? ` — Lý do: ${reason}` : ""}`;
}

async function banMember({ guild, member, executor, reason, deleteDays, guildConfig }) {
  await member.ban({ reason: reason || undefined, deleteMessageSeconds: (deleteDays || 0) * 86_400 });
  await logModAction(guild, guildConfig, {
    action: "🚫 Ban",
    color: Colors.Red,
    target: member.user,
    reason,
    extra: [
      { name: "Xóa tin nhắn", value: deleteDays ? `${deleteDays} ngày` : "Không", inline: true },
      { name: "Người thực hiện", value: `${executor} (\`${executor.id}\`)`, inline: true },
    ],
  });
  return `Đã ban **${member.user.tag}**${reason ? ` — Lý do: ${reason}` : ""}`;
}

async function purgeChannel(channel, count, executor, guildConfig) {
  const n = Math.max(1, Math.min(100, Math.floor(count)));
  const deleted = await channel.bulkDelete(n, true);
  const embed = new EmbedBuilder()
    .setColor(Colors.Blue)
    .setTitle("🧹 Purge")
    .setTimestamp()
    .addFields(
      { name: "Kênh", value: `${channel} (\`${channel.id}\`)`, inline: true },
      { name: "Số tin nhắn", value: `${deleted.size}`, inline: true },
      { name: "Người thực hiện", value: `${executor} (\`${executor.id}\`)`, inline: true },
    )
    .setFooter({ text: "Protogon · Công cụ Mod" });
  await sendLog(channel.guild, guildConfig, embed);
  return `Đã xóa **${deleted.size}** tin nhắn trong ${channel}`;
}

module.exports = {
  parseDuration,
  formatDuration,
  canMod,
  needPerm,
  timeoutMember,
  kickMember,
  banMember,
  purgeChannel,
  logModAction,
  PermissionFlagsBits,
};
