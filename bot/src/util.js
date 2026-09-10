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

/**
 * Gửi embed trực tiếp vào kênh text (fallback an toàn khi webhook không hoạt động).
 * Trả về true nếu gửi thành công.
 */
async function sendToChannel(guild, channelId, embed) {
  if (!guild || !channelId) return false;
  try {
    const channel = await guild.channels.fetch(channelId).catch(() => null);
    if (channel && channel.isTextBased()) {
      await channel.send({ embeds: [embed] });
      return true;
    }
  } catch {
    // kênh bị xóa / thiếu quyền Send Messages — bỏ qua
  }
  return false;
}

/**
 * Gửi embed qua webhook (nếu guild có webhook khớp hạng mục sự kiện).
 * Trả về true khi ÍT NHẤT 1 webhook nhận thành công — caller bỏ qua kênh thường.
 * Không có webhook / gửi thất bại → fallback gửi trực tiếp vào kênh (an toàn).
 * meta: { action, reason, user, mod } để chèn vào placeholder nội dung kèm.
 */
async function deliverViaWebhooks(guild, eventType, embed, meta = {}, targetChannelId) {
  if (!guild) return false;
  try {
    const hub = require("./webhookHub");
    let matched = await hub.matchFor(guild.id, eventType);

    // Nếu chưa có webhook nào — thử tạo on-the-fly "Protogon Log".
    // targetChannelId: kênh ưu tiên tạo webhook (modLog → log).
    if (matched.length === 0 && targetChannelId) {
      const created = await hub.ensureDefaultWebhook(guild, targetChannelId);
      if (created) matched = [created];
    }

    if (matched.length === 0) {
      // Fallback: gửi trực tiếp vào kênh (khi webhook không tạo được — thiếu quyền ManageWebhooks)
      return await sendToChannel(guild, targetChannelId, embed);
    }
    let sent = 0;
    for (const wh of matched) {
      try {
        await hub.send(wh, embed, { guildName: guild.name, ...meta });
        sent++;
      } catch {
        // webhook hỏng (đã xóa / thiếu quyền) — thử webhook khác
      }
    }
    if (sent === 0 && targetChannelId) {
      // Tất cả webhook đều hỏng — fallback kênh thường
      return await sendToChannel(guild, targetChannelId, embed);
    }
    return sent > 0;
  } catch {
    // Lỗi không xác định — fallback kênh thường nếu có
    return await sendToChannel(guild, targetChannelId, embed);
  }
}

/**
 * Nhận diện hạng mục log chi tiết từ TIÊU ĐỀ embed khi caller không truyền rõ
 * (các module anti nuke/raid, join gate, lockdown vẫn gọi sendLog 3 tham số).
 * Nhờ vậy webhook chọn hạng mục "antinuke"/"raid"/"join" vẫn nhận đúng log
 * mà không cần sửa từng điểm gọi.
 */
function inferEventType(embed, fallback = "general") {
  const title = String(embed?.data?.title || embed?.title || "");
  if (/anti nuke\/raid/i.test(title)) {
    return /raid/i.test(title) ? "raid" : "antinuke";
  }
  if (/join gate|alt detected|verify/i.test(title)) return "join";
  if (/lockdown|khóa kênh/i.test(title)) return "raid";
  return fallback;
}

/**
 * Log chung — cảnh báo ANTI NUKE / RAID và sự kiện quan trọng.
 * eventType: "antinuke" | "raid" | "join" | "leave" | "settings" | "general"…
 * Không truyền → tự nhận diện từ tiêu đề embed (vẫn fallback "general").
 * Ưu tiên webhook khớp hạng mục; không có thì gửi tới logChannelId.
 */
async function sendLog(guild, guildConfig, embed, eventType, meta = {}) {
  // Chỉ chạy khi guild ĐÃ bật log (kênh log chung hoặc kênh mod log) — đúng yêu
  // cầu: webhook mặc định chỉ hoạt động sau khi chủ server set kênh log.
  if (!guildConfig || (!guildConfig.logChannelId && !guildConfig.modLogChannelId)) return;
  const et = eventType || inferEventType(embed);
  const targetChannel = guildConfig.modLogChannelId ?? guildConfig.logChannelId;
  // Toàn bộ log gửi qua webhook — KHÔNG fallback kênh thường.
  await deliverViaWebhooks(guild, et, embed, meta, targetChannel);
}

/**
 * Log MODERATION (auto-mod + lệnh mod thủ công: ban/timeout/kick/warn + gỡ hình
 * phạt, purge, bot xóa tin nhắn) — GỘP CHUNG một kênh, kiểu Carl-bot. Gửi tới
 * punishNoticeChannelId (nếu có) → modLogChannelId → kênh log chung.
 * eventType: "ban" | "kick" | "timeout" | "warn" | "purge" | "unban" | "untimeout"…
 * Fallback qua từng kênh: nếu kênh ưu tiên đã bị xóa/hỏng thì vẫn ghi được
 * (không để mất log case).
 */
async function sendModLog(guild, guildConfig, embed, preferChannelId, eventType = "mod", meta = {}) {
  if (!guildConfig) return false;
  const targetChannel = preferChannelId ?? guildConfig.modLogChannelId ?? guildConfig.logChannelId;
  // Toàn bộ log gửi qua webhook — KHÔNG fallback kênh thường.
  return await deliverViaWebhooks(guild, eventType, embed, meta, targetChannel);
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
