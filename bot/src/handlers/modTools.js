const { PermissionFlagsBits } = require("discord.js");
const { canManageWithConfig } = require("../util");
const { sendPunishNotice } = require("../punishNotice");
const { sendCaseLog, CASE_LABEL } = require("../caseLog");

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

/**
 * Ghi log hành động mod THỦ CÔNG (ban/timeout/kick/warn + gỡ hình phạt) kiểu
 * Carl-bot vào kênh log moderation (modLogChannelId, mặc định kênh log chung):
 * ghi bảng hình phạt TRƯỚC để lấy số case, rồi gửi embed
 * "⏱️ Timeout | case N" với Offender / Reason / Responsible moderator.
 */
async function logModAction(guild, guildConfig, { actionKey, target, executor, reason, extra = [] }, store) {
  // Ghi vào bảng hình phạt trên dashboard (nếu có store) → lấy số case.
  let caseNumber;
  if (store) {
    try {
      const rec = await store.client.mutation("bot_writes:botRecordModAction", {
        guildId: guild.id,
        action:
          (CASE_LABEL[actionKey] || actionKey)
            .replace(/[^\p{L}\p{N}\s]/gu, "")
            .trim()
            .slice(0, 20) || actionKey,
        targetId: target?.id ?? undefined,
        targetName: target?.username ?? undefined,
        executorId: executor?.id ?? undefined,
        executorName: executor?.username ?? undefined,
        reason: reason || undefined,
        details: extra.map((f) => `${f.name}: ${f.value}`).join(" · ").slice(0, 200) || undefined,
      });
      caseNumber = rec?.caseNumber;
    } catch (e) {
      console.error(`[modTools:record] ${guild.id}:`, e.message);
    }
  }
  try {
    await sendCaseLog({
      guild,
      guildConfig,
      action: actionKey,
      caseNumber,
      offender: target,
      reason,
      executor,
      extraDescription: extra.map((f) => `**${f.name}:** ${f.value}`),
    });
  } catch (e) {
    console.error(`[modTools:log] ${guild.id}:`, e.message);
  }
}

async function timeoutMember({ guild, member, executor, minutes, reason, guildConfig, store }) {
  await member.timeout(minutes * 60_000, reason || undefined);
  await sendPunishNotice({
    guild,
    guildConfig,
    punishType: "timeout",
    target: member.user,
    executor,
    reason,
    extra: [{ name: "Thời lượng", value: formatDuration(minutes), inline: true }],
  });
  await logModAction(
    guild,
    guildConfig,
    {
      actionKey: "timeout",
      target: member.user,
      executor,
      reason,
      extra: [{ name: "Thời lượng", value: formatDuration(minutes) }],
    },
    store,
  );
  return `Đã timeout **${member.user.tag}** trong ${formatDuration(minutes)}${reason ? ` — Lý do: ${reason}` : ""}`;
}

async function kickMember({ guild, member, executor, reason, guildConfig, store }) {
  await member.kick(reason || undefined);
  await sendPunishNotice({
    guild,
    guildConfig,
    punishType: "kick",
    target: member.user,
    executor,
    reason,
  });
  await logModAction(
    guild,
    guildConfig,
    {
      actionKey: "kick",
      target: member.user,
      executor,
      reason,
    },
    store,
  );
  return `Đã kick **${member.user.tag}**${reason ? ` — Lý do: ${reason}` : ""}`;
}

async function banMember({ guild, member, executor, reason, deleteDays, guildConfig, store }) {
  await member.ban({ reason: reason || undefined, deleteMessageSeconds: (deleteDays || 0) * 86_400 });
  await sendPunishNotice({
    guild,
    guildConfig,
    punishType: "ban",
    target: member.user,
    executor,
    reason,
    extra: [{ name: "Xóa tin nhắn", value: deleteDays ? `${deleteDays} ngày` : "Không", inline: true }],
  });
  await logModAction(
    guild,
    guildConfig,
    {
      actionKey: "ban",
      target: member.user,
      executor,
      reason,
      extra: [{ name: "Xóa tin nhắn", value: deleteDays ? `${deleteDays} ngày` : "Không" }],
    },
    store,
  );
  return `Đã ban **${member.user.tag}**${reason ? ` — Lý do: ${reason}` : ""}`;
}

async function untimeoutMember({ guild, member, executor, reason, guildConfig, store }) {
  await member.timeout(null, reason || undefined);
  await logModAction(
    guild,
    guildConfig,
    {
      actionKey: "untimeout",
      target: member.user,
      executor,
      reason,
    },
    store,
  );
  return `Đã gỡ timeout cho **${member.user.tag}**${reason ? ` — Lý do: ${reason}` : ""}`;
}

async function unbanMember({ guild, userId, executor, reason, guildConfig, store }) {
  await guild.members.unban(userId, reason || undefined);
  await logModAction(
    guild,
    guildConfig,
    {
      actionKey: "unban",
      target: { id: userId, username: userId },
      executor,
      reason,
    },
    store,
  );
  return `Đã gỡ ban cho **<@${userId}>**${reason ? ` — Lý do: ${reason}` : ""}`;
}

async function unwarnMember({ guild, userId, heat, executor, reason, guildConfig, store }) {
  heat.clearStrikes(guild.id, userId);
  await logModAction(
    guild,
    guildConfig,
    {
      actionKey: "unwarn",
      target: { id: userId, username: userId },
      executor,
      reason,
    },
    store,
  );
  return `Đã gỡ toàn bộ warn tích lũy của **<@${userId}>**${reason ? ` — Lý do: ${reason}` : ""}`;
}

async function purgeChannel(channel, count, executor, guildConfig, store) {
  const n = Math.max(1, Math.min(100, Math.floor(count)));
  const deleted = await channel.bulkDelete(n, true);
  // Ghi bảng hình phạt trước để lấy số case.
  let caseNumber;
  if (store) {
    try {
      const rec = await store.client.mutation("bot_writes:botRecordModAction", {
        guildId: channel.guild.id,
        action: "Purge",
        executorId: executor.id,
        executorName: executor.username,
        reason: undefined,
        details: `Xóa ${deleted.size} tin nhắn tại #${channel.name}`,
      });
      caseNumber = rec?.caseNumber;
    } catch (e) {
      console.error(`[modTools:record] ${channel.guild.id}:`, e.message);
    }
  }
  try {
    await sendCaseLog({
      guild: channel.guild,
      guildConfig,
      action: "purge",
      caseNumber,
      offender: null,
      reason: `Xóa ${deleted.size} tin nhắn tại #${channel.name}`,
      executor,
      extraDescription: [`**Kênh:** ${channel} (\`${channel.id}\`)`],
    });
  } catch (e) {
    console.error(`[modTools:purge:log] ${channel.guild.id}:`, e.message);
  }
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
  untimeoutMember,
  unbanMember,
  unwarnMember,
  logModAction,
  PermissionFlagsBits,
};
