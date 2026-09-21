"use strict";
/**
 * MISFIRE FEEDBACK LOOP (vòng 11) — bot tự học từ phạt nhầm ĐÃ XÁC NHẬN.
 *
 * Luồng dữ liệu (0 token, 0 I/O mạng — toàn bộ trong RAM):
 *   1. punishMember() (heat.js) phạt tự động thành công → notePunished() ghi
 *      "{guildId}:{userId} → {punish, at}" (chỉ đường TỰ ĐỘNG — mod phạt tay
 *      không đi qua hàm này nên không bị đếm nhầm).
 *   2. Mod gỡ phạt (untimeout/unban trong modTools.js) → noteRepealed():
 *      nếu user vừa bị phạt tự động trong 7 ngày → PHẠT NHẦM ĐÃ XÁC NHẬN —
 *      đếm misfire + log. Không tìm thấy = gỡ phạt thủ công thường → bỏ qua.
 *   3. ai.js đọc misfireCount7d(): ≥5 vụ 7 ngày qua → bias −0.05 + dòng "TỰ SOI"
 *      trong prompt → model cân nhắc kỹ hơn trước khi kết luận raid.
 *
 * Là module LÁ (không require gì) để tránh vòng require với heat/ai.
 */

const WINDOW_MS = 7 * 86_400_000;

/** guildId:userId -> { at, punish } (phạt tự động đang "treo" chờ mod xét). */
const punished = new Map();
/** Timestamp các misfire đã xác nhận (prune theo cửa sổ 7 ngày). */
const misfires = [];

function prune(now = Date.now()) {
  for (const [k, v] of punished) {
    if (now - v.at >= WINDOW_MS) punished.delete(k);
  }
  while (misfires.length && now - misfires[0] >= WINDOW_MS) misfires.shift();
}

/**
 * Ghi nhận: bot vừa phạt TỰ ĐỘNG thành công một thành viên (ban/kick/timeout).
 * Gọi SAU khi hành động thành công (result bắt đầu bằng "đã") — lỗi quyền/
 * vượt action budget thì không ghi (không có phạt nào để gỡ).
 */
function notePunished(guildId, userId, punish) {
  if (!guildId || !userId) return;
  if (!["ban", "kick", "timeout"].includes(punish)) return; // warn không có "gỡ" đối xứng
  prune();
  punished.set(`${guildId}:${userId}`, { at: Date.now(), punish });
}

/**
 * Mod vừa GỠ phạt cho user. Trả về true khi đây là misfire AI đã xác nhận
 * (user đang nằm trong danh sách phạt tự động 7 ngày qua).
 */
function noteRepealed(guildId, userId) {
  if (!guildId || !userId) return false;
  prune();
  const key = `${guildId}:${userId}`;
  const rec = punished.get(key);
  if (!rec) return false; // gỡ phạt thủ công / đã quá 7 ngày → không đếm
  punished.delete(key);
  misfires.push(Date.now());
  const hours = Math.round((Date.now() - rec.at) / 3600_000);
  console.log(
    `[ai:misfire] ${guildId}/${userId}: mod gỡ ${rec.punish} sau ~${hours}h → phạt nhầm đã xác nhận (tổng 7 ngày: ${misfireCount7d()})`,
  );
  return true;
}

/** Số misfire đã xác nhận trong 7 ngày qua — đầu vào bias của ai.js. */
function misfireCount7d() {
  prune();
  return misfires.length;
}

/** Dữ liệu cho /health — không lộ id user. */
function misfireStats() {
  prune();
  return { misfires7d: misfires.length, pending: punished.size };
}

/** Test hook (convention _…ForTest): xoá sạch state giữa các case. */
function _misfireForTest() {
  punished.clear();
  misfires.length = 0;
}

module.exports = {
  notePunished,
  noteRepealed,
  misfireCount7d,
  misfireStats,
  _misfireForTest,
};
