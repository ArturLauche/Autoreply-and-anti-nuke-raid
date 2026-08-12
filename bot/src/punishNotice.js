const { EmbedBuilder, Colors } = require("discord.js");

/**
 * Thông báo sau khi bot trừng phạt thành viên (Moderation).
 *
 * Mức chi tiết theo từng hành động (guildConfig.punishNotice):
 *  - none:   không gửi tin nhắn
 *  - action: kênh thông báo + hành động bot đã làm (vd "🚫 Đã ban @user")
 *  - reason: thêm lý do vi phạm
 *  - full:   thêm moderator đã áp dụng hình phạt
 *
 * Kênh nhận: punishNoticeChannelId → modLogChannelId → logChannelId.
 */

const LEVEL_ORDER = { none: 0, action: 1, reason: 2, full: 3 };

const ACTION_LABEL = { ban: "🚫 Ban", timeout: "⏱️ Timeout", kick: "👢 Kick", warn: "⚠️ Warn" };
const ACTION_PAST = {
  ban: "đã ban",
  timeout: "đã tạm khóa",
  kick: "đã kick",
  warn: "đã cảnh báo (warn)",
};
const ACTION_COLOR = { ban: Colors.Red, timeout: Colors.Orange, kick: Colors.Red, warn: Colors.Yellow };

/**
 * Gửi thông báo hình phạt theo cấu hình Moderation của guild.
 * Trả về true nếu đã gửi, false nếu tắt / thiếu kênh.
 */
async function sendPunishNotice({ guild, guildConfig, punishType, target, executor, reason, extra = [] }) {
  try {
    if (!guild || !guildConfig) return false;
    const notice = guildConfig.punishNotice || {};
    const level = notice[punishType] || "none";
    if (!LEVEL_ORDER[level] || LEVEL_ORDER[level] === 0) return false;

    const channelId =
      guildConfig.punishNoticeChannelId ||
      guildConfig.modLogChannelId ||
      guildConfig.logChannelId;
    if (!channelId) return false;
    const channel = await guild.channels.fetch(channelId).catch(() => null);
    if (!channel || !channel.isTextBased()) return false;

    const fields = [];
    if (target) {
      fields.push({ name: "Thành viên", value: `${target} (${target.id})`, inline: true });
    }
    fields.push({
      name: "Hành động của bot",
      value: ACTION_PAST[punishType] || punishType,
      inline: true,
    });
    if (LEVEL_ORDER[level] >= 2) {
      fields.push({
        name: "Lý do",
        value: (reason || "Không có").slice(0, 1000),
        inline: false,
      });
    }
    if (LEVEL_ORDER[level] >= 3) {
      fields.push({
        name: "Moderator",
        value: executor ? `${executor} (${executor.id})` : "Bot tự động",
        inline: true,
      });
    }
    for (const f of extra) fields.push(f);

    const embed = new EmbedBuilder()
      .setColor(ACTION_COLOR[punishType] || Colors.Red)
      .setTitle(`🛡️ ${ACTION_LABEL[punishType] || punishType}`)
      .setDescription(`Protogon vừa xử lý một vi phạm trên server.`)
      .addFields(fields)
      .setTimestamp()
      .setFooter({ text: "Protogon · Moderation" });

    await channel.send({ embeds: [embed] });
    return true;
  } catch (e) {
    console.error(`[punishNotice] ${guild?.id}:`, e.message);
    return false;
  }
}

module.exports = { sendPunishNotice };
