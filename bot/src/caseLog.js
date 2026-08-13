const { EmbedBuilder, Colors } = require("discord.js");
const { sendModLog } = require("./util");

/** Các hành động có mức chi tiết cấu hình được trên web (phần Moderation). */
const NOTICE_ACTIONS = ["ban", "timeout", "kick", "warn"];
/** Thứ tự mức chi tiết: none (0) → action (1) → reason (2) → full (3). */
const LEVEL_ORDER = { none: 0, action: 1, reason: 2, full: 3 };

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

  // ĐỒNG BỘ VỚI PHẦN MODERATION TRÊN WEB: mức chi tiết theo từng hành động
  // (none/action/reason/full) + kênh gửi (punishNoticeChannelId → mod log → log chung).
  //  - none   → không gửi embed (dashboard vẫn ghi nhận hình phạt)
  //  - action → Offender
  //  - reason → thêm Reason (trống → "không có lý do")
  //  - full   → thêm Responsible moderator (bot tự động = tên bot, mod lệnh = tên người dùng)
  // purge / delete (không nằm trong bảng cấu hình) luôn hiển thị đầy đủ.
  const level = NOTICE_ACTIONS.includes(action)
    ? guildConfig.punishNotice?.[action] || "full"
    : "full";
  if ((LEVEL_ORDER[level] ?? 3) === 0) return null;

  const botUser = guild.client?.user;
  const responsible = executor
    ? executor.username || executor.tag || "mod"
    : botUser
      ? botUser.username
      : "Bot";

  const lines = [];
  if (offender && offender.id) {
    lines.push(`**Offender:** ${offender.username || offender.id} <@${offender.id}>`);
  }
  if ((LEVEL_ORDER[level] ?? 3) >= 2) {
    lines.push(`**Reason:** ${reason || "không có lý do"}`);
  }
  if ((LEVEL_ORDER[level] ?? 3) >= 3) {
    lines.push(`**Responsible moderator:** ${responsible}`);
  }
  for (const line of extraDescription) lines.push(String(line));

  const embed = new EmbedBuilder()
    .setColor(color ?? CASE_COLOR[action] ?? Colors.Red)
    .setTitle(`${label}${caseNumber ? ` | case ${caseNumber}` : ""}`)
    .setDescription(lines.join("\n"))
    .setTimestamp();
  embed.setFooter({
    text: offender && offender.id ? `ID: ${offender.id} • ${fmtTimestamp()}` : fmtTimestamp(),
  });

  // Kênh gửi ưu tiên kênh thông báo hình phạt (Moderation trên web), rồi log mod, rồi log chung.
  await sendModLog(guild, guildConfig, embed, guildConfig.punishNoticeChannelId);
  return embed;
}

module.exports = { sendCaseLog, fmtTimestamp, CASE_COLOR, CASE_LABEL, NOTICE_ACTIONS, LEVEL_ORDER };
