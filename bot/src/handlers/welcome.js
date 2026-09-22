"use strict";
/**
 * welcome.js — Chào thành viên mới + tạm biệt thành viên rời server.
 *
 * Config từ dashboard (Welcome & Goodbye panel): bật/tắt, kênh riêng cho mỗi
 * loại, nội dung tùy chỉnh với placeholder {user} {server} {count} — bot thay
 * lúc gửi. Embed hoặc tin nhắn thường tùy chọn.
 *
 * An toàn: mọi gửi best-effort (kênh bị xoá/thiếu quyền → bỏ qua im lặng,
 * KHÔNG spam log); goodbye bỏ qua bot (bot rời là sự kiện kỹ thuật, không
 * phải "thành viên rời"); nội dung trống → dùng mặc định. Gửi qua channel.send
 * với allowedMentions giới hạn cho {user} — tránh @everyone từ nội dung tùy
 * chỉnh (kẻ có quyền dashboard không thể ping sập server qua welcome).
 */

const { EmbedBuilder, Colors, PermissionFlagsBits } = require("discord.js");
const lang = require("./lang");

/** Mặc định EN (tương thích cũ) — luồng thật dùng lang.*Default(serverLang) theo ngôn ngữ server. */
const WELCOME_DEFAULT = lang.welcomeDefault("en");
const GOODBYE_DEFAULT = lang.goodbyeDefault("en");

/**
 * Nội dung mặc định khi config để trống — THEO NGÔN NGỮ SERVER (locale quốc
 * gia chủ server chọn; quốc gia không có bản dịch riêng → EN mặc định).
 * Owner đặt nội dung tùy chỉnh → dùng nguyên văn (tôn trọng nội dung đã viết).
 */

/** Thay placeholder. {user} giữ nguyên dạng mention để allowedMentions hoạt động. */
function fillTemplate(template, { member, guild }) {
  return template
    .replaceAll("{user}", `<@${member.id}>`)
    .replaceAll("{username}", member.user?.username ?? member.id)
    .replaceAll("{server}", guild.name)
    .replaceAll("{count}", String(guild.memberCount ?? 0))
    .slice(0, 1500);
}

/** Gửi tin welcome/goodbye vào kênh cấu hình. Trả true khi gửi thành công. */
async function sendGreeting(client, config, kind, member, guild) {
  const enabled = kind === "welcome" ? config.welcomeEnabled : config.goodbyeEnabled;
  if (!enabled) return false;
  const channelId = kind === "welcome" ? config.welcomeChannelId : config.goodbyeChannelId;
  if (!channelId) return false;
  const serverLang = lang.langForGuild(guild);
  const rawTemplate =
    (kind === "welcome" ? config.welcomeMessage : config.goodbyeMessage)?.trim() ||
    (kind === "welcome" ? lang.welcomeDefault(serverLang) : lang.goodbyeDefault(serverLang));
  const useEmbed = kind === "welcome" ? config.welcomeUseEmbed : config.goodbyeUseEmbed;

  const channel = await client.channels.fetch(channelId).catch(() => null);
  if (!channel?.isTextBased?.()) return false;
  // Thiếu quyền gửi → bỏ qua im lặng (không spam log mỗi lượt join).
  // Optional chaining đầy đủ: guild.members có thể undefined (guild partial).
  const perms = guild.members?.me?.permissionsIn?.(channel);
  if (perms && !perms.has(PermissionFlagsBits.SendMessages)) return false;

  const content = fillTemplate(rawTemplate, { member, guild });

  let payload;
  if (useEmbed) {
    const embed = new EmbedBuilder()
      .setColor(kind === "welcome" ? Colors.Green : Colors.Grey)
      .setDescription(content)
      .setTimestamp();
    payload = {
      content: `<@${member.id}>`,
      embeds: [embed],
      allowedMentions: { users: [member.id], parse: [] },
    };
  } else {
    payload = { content, allowedMentions: { users: [member.id], parse: [] } };
  }

  const sent = await channel
    .send(payload)
    .then(() => true)
    .catch(() => false);
  return sent;
}

/** guildMemberAdd — chào thành viên mới (bỏ qua bot). */
async function handleWelcome(client, store, member) {
  try {
    if (!member?.guild || member.user?.bot) return;
    const config = await store.getConfig(member.guild.id);
    if (!config) return;
    await sendGreeting(client, config, "welcome", member, member.guild);
  } catch (e) {
    console.error("[welcome]", e.message);
  }
}

/** guildMemberRemove — tạm biệt thành viên rời (bỏ qua bot). */
async function handleGoodbye(client, store, member) {
  try {
    if (!member?.guild || member.user?.bot) return;
    const config = await store.getConfig(member.guild.id);
    if (!config) return;
    await sendGreeting(client, config, "goodbye", member, member.guild);
  } catch (e) {
    console.error("[goodbye]", e.message);
  }
}

/** Test hooks (convention _…ForTest): dùng để so khớp template trong test. */
module.exports = {
  handleWelcome,
  handleGoodbye,
  WELCOME_DEFAULT,
  GOODBYE_DEFAULT,
  _fillTemplateForTest: fillTemplate,
};
