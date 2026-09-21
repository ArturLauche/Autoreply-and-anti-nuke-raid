"use strict";
/**
 * ownerAlert.js — DM KHẨN CHO OWNER khi server bị tấn công.
 *
 * Vì sao cần: emergencyRaidAlert (incidentReport.js) gửi cảnh báo vào KÊNH LOG
 * + @everyone — nhưng kẻ nuke có quyền quản lý thường XOÁ KÊNH LOG hoặc tự gỡ
 * webhook trước khi phá. Owner (người chịu trách nhiệm cuối cùng) có thể không
 * biết gì cho tới khi vào lại server. DM cho owner là kênh không thể bị xoá
 * từ bên trong server — kẻ tấn công không chặn được.
 *
 * Nguồn sự kiện (2 điểm nối, xem afterPunishHooks + handleAttributeEvent):
 *   1. Nuke/raid xác nhận (massBan, massChannelDelete, externalAppRaid…)
 *   2. Thủ phạm là OWNER/ADMIN/whitelist — bot cố tình KHÔNG phạt nhóm này
 *      (tránh phạt oan chủ server/mod hợp pháp) nhưng hành vi nuke vẫn phải
 *      báo: owner biết kẻ có quyền quản lý đang phá server là thông tin sống còn.
 *
 * Thiết kế:
 *   - Cooldown 5 phút/guild — 1 vụ raid kích nhiều module không spam DM.
 *   - Tôn trọng toggle emergencyAlertEnabled (web Settings đã có sẵn).
 *   - DM thất bại (owner tắt DM từ bot) → fallback gửi vào kênh log.
 *   - Fire-and-forget: không bao giờ chặn pipeline xử phạt.
 *   - 0 token AI (khác emergencyRaidAlert có AI tổng hợp) — DM là tín hiệu
 *     "dậy ngay", nội dung chi tiết đã ở kênh log + /report.
 */

const { Colors } = require("discord.js");
const { logEmbed, sendLog } = require("../../util");

/** Chờ giữa 2 DM khẩn cùng guild — một vụ raid kích nhiều module chỉ DM 1 lần. */
const COOLDOWN_MS = 5 * 60_000;

/** guildId -> timestamp DM gần nhất. */
const lastAlertAt = new Map();

/** Dọn guild đã rời (memGuard gọi) — trả về số entry đã xoá. */
function pruneCache(liveGuildIds) {
  let removed = 0;
  for (const guildId of [...lastAlertAt.keys()]) {
    if (!liveGuildIds.has(guildId)) {
      lastAlertAt.delete(guildId);
      removed++;
    }
  }
  return removed;
}

/** Test hook (convention _…ForTest): xoá sạch state giữa các case. */
function _ownerAlertForTest() {
  lastAlertAt.clear();
}

/**
 * DM khẩn cho owner. Trả về true khi gửi thành công (DM hoặc fallback log).
 * @param {object} opts { guild, module, summary, executorId?, executorName?, privileged? }
 */
async function alertOwner(client, store, opts = {}) {
  try {
    const { guild, module, summary, executorId, executorName, privileged } = opts;
    if (!guild || !store) return false;
    const now = Date.now();
    const last = lastAlertAt.get(guild.id) ?? 0;
    if (now - last < COOLDOWN_MS) return false;
    lastAlertAt.set(guild.id, now);

    const config = await store.getConfig(guild.id);
    if (!config) return false;
    // Tôn trọng toggle — chủ server tắt cảnh báo khẩn thì cả DM cũng tắt.
    if (config.emergencyAlertEnabled === false) return false;

    const title = privileged
      ? "⚠️ Người có quyền quản lý đang phá server!"
      : "🚨 Server đang bị tấn công!";
    const lines = [
      `**Server:** ${guild.name} (${guild.memberCount ?? "?"} thành viên)`,
      `**Loại:** ${summary || module || "raid/nuke"}`,
    ];
    if (executorId) {
      lines.push(
        `**Thủ phạm:** ${executorName ? `${executorName} (` : ""}<@${executorId}>${executorName ? ")" : ""}`,
      );
    }
    if (privileged) {
      lines.push(
        "> Bot **không phạt** người này (owner/whitelist/admin bị miễn để tránh phạt oan hợp pháp). Nếu đây là tấn công thật, hãy gỡ quyền/whitelist ngay.",
      );
    } else {
      lines.push("> Bot đã xử lý tự động. Chi tiết + báo cáo AI: kênh log trong server.");
    }

    const embed = logEmbed({
      title,
      description: lines.join("\n"),
      color: privileged ? Colors.Orange : Colors.Red,
      fields: [{ name: "Thời điểm", value: `<t:${Math.floor(now / 1000)}:F>`, inline: false }],
      footer: "Protogon · Owner Alert",
    });

    // DM owner trước — kênh không bị xoá được từ trong server.
    const owner = await client.users.fetch(guild.ownerId).catch(() => null);
    if (owner) {
      const sent = await owner
        .send({ embeds: [embed] })
        .then(() => true)
        .catch(() => false);
      if (sent) {
        console.log(
          `[ownerAlert] ${guild.id}: đã DM owner${privileged ? " (privileged executor)" : ""}`,
        );
        return true;
      }
    }
    // Owner tắt DM từ bot → fallback kênh log (vẫn tốt hơn im lặng).
    await sendLog(guild, config, embed, "raid").catch(() => {});
    console.log(`[ownerAlert] ${guild.id}: DM thất bại — fallback kênh log`);
    return true;
  } catch (e) {
    console.error("[ownerAlert]", e.message);
    return false;
  }
}

module.exports = { alertOwner, pruneCache, COOLDOWN_MS, _ownerAlertForTest };
