const { EmbedBuilder, Colors } = require("discord.js");
const { sendModLog } = require("./util");

/** Màu của từng hành động (cũng là thanh accent bên trái embed, kiểu Carl-bot). */
const CASE_COLOR = {
  ban: Colors.Red,
  timeout: Colors.Orange,
  kick: Colors.Red,
  warn: Colors.Yellow,
  purge: Colors.Blue,
  untimeout: Colors.Green,
  unban: Colors.Green,
  unwarn: Colors.Green,
  delete: Colors.DarkerGrey,
};

/** Nhãn tiêu đề cho từng hành động. */
const CASE_LABEL = {
  ban: "🚫 Ban",
  timeout: "⏱️ Timeout",
  kick: "👢 Kick",
  warn: "⚠️ Warn",
  purge: "🧹 Purge",
  untimeout: "🔓 Gỡ timeout",
  unban: "🔓 Gỡ ban",
  unwarn: "🧹 Gỡ warn",
  delete: "🗑️ Message deleted",
};

/** Format thời gian kiểu Carl-bot: "00:49 2/8/26". */
function fmtTimestamp(ts = Date.now()) {
  const d = new Date(ts);
  const hh = String(d.getHours()).padStart(2, "0");
  const mm = String(d.getMinutes()).padStart(2, "0");
  const day = d.getDate();
  const month = d.getMonth() + 1;
  const year = String(d.getFullYear()).slice(2);
  return `${hh}:${mm} ${day}/${month}/${year}`;
}

/**
 * Gửi embed log moderation kiểu Carl-bot tới KÊNH LOG MODERATION (gộp chung
 * auto-mod + lệnh mod thủ công) — modLogChannelId, mặc định kênh log chung.
 *
 * - offender: { id, username } — thành viên bị xử lý (bỏ qua với purge).
 * - executor: người dùng lệnh thủ công; null/undefined = bot tự động → dòng
 *   "Responsible moderator" hiển thị tên bot.
 * - reason: lý do vi phạm (auto-mod) hoặc lý do mod ghi; để trống → "không có lý do".
 * - caseNumber: số case tăng dần của server ("warn | case 30"); bỏ qua khi không có.
 * - extraDescription: các dòng bổ sung phía dưới (vd thời lượng timeout, xóa N ngày…).
 */
async function sendCaseLog({
  guild,
  guildConfig,
  action,
  caseNumber,
  offender,
  reason,
  executor,
  color,
  extraDescription = [],
}) {
  if (!guild || !guildConfig) return null;
  const label = CASE_LABEL[action] || action;
  const botUser = guild.client?.user;
  const responsible = executor
    ? executor.username || executor.tag || "mod"
    : botUser
      ? botUser.username
      : "Bot";

  const lines = [];
  if (offender && offender.id) {
    lines.push(
      `**Offender:** ${offender.username || offender.id} <@${offender.id}>`,
    );
  }
  lines.push(`**Reason:** ${reason || "không có lý do"}`);
  lines.push(`**Responsible moderator:** ${responsible}`);
  for (const line of extraDescription) lines.push(String(line));

  const embed = new EmbedBuilder()
    .setColor(color ?? CASE_COLOR[action] ?? Colors.Red)
    .setTitle(`${label}${caseNumber ? ` | case ${caseNumber}` : ""}`)
    .setDescription(lines.join("\n"))
    .setTimestamp();
  embed.setFooter({
    text: offender && offender.id ? `ID: ${offender.id} • ${fmtTimestamp()}` : fmtTimestamp(),
  });

  await sendModLog(guild, guildConfig, embed);
  return embed;
}

module.exports = { sendCaseLog, fmtTimestamp, CASE_COLOR, CASE_LABEL };
