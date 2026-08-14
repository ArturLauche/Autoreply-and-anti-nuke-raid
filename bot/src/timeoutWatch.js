/**
 * Theo dõi timeout đang áp dụng của từng thành viên (bộ nhớ trong process).
 *
 * Mục đích: khi timeout HẾT HẠN TỰ NHIÊN, bot ghi một embed case kiểu Carl-bot
 * ("⏱️ Timeout hết hạn") — phân biệt với trường hợp mod chủ động GỠ timeout
 * (lệnh /mod untimeout — vốn đã có log riêng).
 *
 * Thời điểm được ghi nhận khi:
 *  - bot tự áp timeout (auto-mod / antinuke / heat) — heat.js punishMember
 *  - mod áp timeout thủ công (/mod timeout) — modTools.js timeoutMember
 *  - bot nhìn thấy timeout mới trên sự kiện guildMemberUpdate (mod áp trực tiếp
 *    trên Discord hoặc bot khác) — attach() bên dưới
 *
 * Khi timeout hết hạn tự nhiên, Discord đổi communicationDisabledUntil → null và
 * phát guildMemberUpdate; attach() phát hiện và gửi embed tới kênh log moderation.
 * Gỡ chủ động thì modTools.js gọi forget() trước → không log nhầm thành hết hạn.
 *
 * Giới hạn: tracker nằm trong RAM — nếu bot khởi động lại giữa chừng, các timeout
 * đang chạy sẽ không được log lúc hết hạn (best-effort, không phạt ai thêm).
 *
 * key = `${guildId}:${userId}` → thời điểm hết hạn (ms).
 */
const { sendCaseLog } = require("./caseLog");

const timeouts = new Map();

function key(guildId, userId) {
  return `${guildId}:${userId}`;
}

/** Ghi nhận một timeout đang chạy, hết hạn lúc `until` (ms). */
function track(guildId, userId, until) {
  if (!guildId || !userId || !Number.isFinite(until)) return;
  timeouts.set(key(guildId, userId), until);
}

/** Bỏ theo dõi (gỡ timeout / hết hạn / thành viên rời server). */
function forget(guildId, userId) {
  timeouts.delete(key(guildId, userId));
}

/** Thời điểm hết hạn đang theo dõi (ms) hoặc null. */
function getUntil(guildId, userId) {
  return timeouts.get(key(guildId, userId)) ?? null;
}

/** Dọn các mục đã hết hạn (chống rò rỉ RAM). */
function sweep() {
  const now = Date.now();
  for (const [k, until] of timeouts) {
    if (until <= now) timeouts.delete(k);
  }
}

/** Số mục đang theo dõi (chẩn đoán). */
function size() {
  return timeouts.size;
}

/**
 * Gắn listener phát hiện timeout hết hạn (gọi 1 lần từ index.js):
 *  - guildMemberUpdate: timeout mới/gia hạn → track; hết hạn tự nhiên (after =
 *    null và đã qua mốc track) → gửi embed "⏱️ Timeout hết hạn"; gỡ sớm → chỉ
 *    forget, không log (untimeout đã có embed riêng).
 *  - guildMemberRemove: forget (thành viên rời server khi đang bị timeout).
 *  - sweep định kỳ 60s dọn bộ nhớ.
 */
function attach(client, store) {
  client.on("guildMemberUpdate", async (_oldMember, newMember) => {
    try {
      const guildId = newMember.guild?.id;
      const userId = newMember.id;
      if (!guildId || !userId) return;
      const after = newMember.communicationDisabledUntil;
      if (after) {
        // Timeout mới hoặc được gia hạn (kể cả áp trực tiếp trên Discord) → theo dõi.
        track(guildId, userId, after.getTime());
        return;
      }
      // Timeout đã được gỡ / hết hạn: quyết định dựa trên mốc đã track.
      const trackedUntil = getUntil(guildId, userId);
      if (!trackedUntil) return;
      // forget đồng bộ TRƯỚC await → nếu Discord phát event chồng nhau, lần sau
      // thấy trackedUntil = null nên không log trùng.
      forget(guildId, userId);
      if (Date.now() < trackedUntil) return; // mod gỡ sớm → không log
      const guildConfig = store ? await store.getConfig(guildId) : null;
      await sendCaseLog({
        guild: newMember.guild,
        guildConfig,
        action: "timeout_expired",
        offender: { id: userId, username: newMember.user?.username ?? userId },
        reason: "Timeout đã hết hạn tự nhiên.",
      });
    } catch (e) {
      console.error("[timeoutWatch]", e?.message || e);
    }
  });

  client.on("guildMemberRemove", (member) => {
    if (member.guild?.id && member.id) forget(member.guild.id, member.id);
  });

  setInterval(() => sweep(), 60_000);
}

module.exports = { track, forget, getUntil, sweep, size, attach };
