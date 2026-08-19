const { Colors } = require("discord.js");
const { logEmbed, sendLog } = require("../util");
const { isLocked } = require("../lockdown");

const DAY_MS = 86_400_000;

/**
 * Cổng vào server (Join Gate): chặn selfbot / tài khoản nghi vấn khi tham gia.
 *
 * Các tiêu chí (bật tắt theo cấu hình guild):
 *  - joinGateMinAgeDays    tài khoản phải đủ X ngày tuổi
 *  - joinGateRequireAvatar phải có avatar riêng (không phải mặc định)
 *  - joinGateRequireFlag   phải có ít nhất 1 huy hiệu công khai (selfbot mới thường không có)
 *  - joinGateRaidKick      khi server đang khóa kênh (raid) thì xử lý mọi thành viên mới
 *  - joinGateWhitelist     danh sách ID luôn được vào
 *
 * Lưu ý: Discord không cho bot đọc trạng thái "email/phone đã xác thực" của người dùng,
 * nên thay vào đó dùng các tín hiệu công khai trên (tuổi, avatar, huy hiệu, trạng thái raid).
 */
async function assignUnverifiedRole(client, member, store) {
  let config;
  try {
    config = await store.getConfig(member.guild.id);
  } catch (err) {
    console.error(`[assignUnverified] ${member.guild.id}:`, err.message);
    return;
  }
  if (!config?.verifyEnabled || !config?.unverifiedRoleId) return;
  try {
    await member.roles.add(config.unverifiedRoleId, "Xác minh thành viên — role mặc định");
  } catch (err) {
    console.error(`[assignUnverified] ${member.guild.id}:`, err.message);
  }
}

module.exports = async function joinGate(client, member, store) {
  if (!member?.guild || member.user?.bot) return; // chỉ xét tài khoản người thật
  // Gán role unverified nếu verify đang bật
  assignUnverifiedRole(client, member, store).catch((e) => console.error(`[assignUnverified]`, e.message));
  let config;
  try {
    config = await store.getConfig(member.guild.id);
  } catch (err) {
    console.error(`[joinGate] ${member.guild.id}:`, err.message);
    return;
  }
  if (!config || !config.joinGateEnabled) return;

  const whitelist = config.joinGateWhitelist || [];
  if (whitelist.includes(member.id)) return; // luôn cho vào

  const failures = [];

  // 1) Tuổi tài khoản
  const minAge = config.joinGateMinAgeDays ?? 0;
  if (minAge > 0) {
    const ageDays = (Date.now() - member.user.createdTimestamp) / DAY_MS;
    if (ageDays < minAge) {
      failures.push(
        `tài khoản mới (**${Math.max(0, Math.floor(ageDays))} ngày** < yêu cầu ${minAge} ngày)`,
      );
    }
  }

  // 2) Avatar riêng
  if (config.joinGateRequireAvatar && !member.user.avatar) {
    failures.push("không có avatar riêng (đang dùng avatar mặc định)");
  }

  // 3) Huy hiệu công khai — selfbot thường là tài khoản mới không có bất kỳ flag nào
  if (config.joinGateRequireFlag) {
    const flags = member.user.flags;
    if (!flags || flags.bitfield === 0) {
      failures.push("không có huy hiệu tài khoản (flag = 0)");
    }
  }

  // 4) Đang bị raid → chặn mọi lượt vào
  if (config.joinGateRaidKick && isLocked(member.guild.id)) {
    failures.push("server đang khóa kênh do raid");
  }

  if (failures.length === 0) return; // qua cổng

  const punish = config.joinGatePunish === "ban" ? "ban" : "kick";
  const reason = `[Protogon Join Gate] ${failures.join("; ")}`;
  let action;
  try {
    if (punish === "ban") {
      await member.ban({ reason, deleteMessageSeconds: 0 });
      action = "đã ban";
    } else {
      await member.kick(reason);
      action = "đã kick";
    }
  } catch (err) {
    action = `không thể ${punish} (thiếu quyền)`;
    console.error(`[joinGate] ${member.guild.id}:`, err.message);
  }

  try {
    await store.client.mutation("bot_writes:botRecordAntinukeEvent", {
      guildId: member.guild.id,
      module: "joinGate",
      executorId: member.id,
      executorName: member.user.username,
      action: `${action} — ${failures.join("; ")}`,
      count: 1,
      windowSeconds: 10,
      threshold: 1,
      punish,
    });
  } catch (err) {
    console.error("[joinGate:record]", err.message);
  }

  const embed = logEmbed({
    title: "🚪 Join Gate: đã chặn thành viên",
    description: `<@${member.id}> vừa tham gia nhưng **không vượt qua cổng vào** và đã bị xử lý.`,
    color: Colors.Red,
    fields: [
      { name: "Thành viên", value: `<@${member.id}> (${member.user.username})`, inline: true },
      { name: "Lý do", value: failures.map((f) => `• ${f}`).join("\n").slice(0, 1000), inline: false },
      { name: "Xử lý", value: action, inline: true },
    ],
    footer: "Protogon Join Gate",
  });
  await sendLog(member.guild, config, embed);
};
