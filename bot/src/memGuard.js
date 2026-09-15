/**
 * memGuard.js — sweeper bộ nhớ TẬP TRUNG (Đợt 7: tối ưu tài nguyên).
 *
 * Vì sao cần: bot chạy 24/7 trên VPS RAM nhỏ. Trước đây từng module tự lo dọn
 * (state.js 20s, timeoutWatch 60s, altDetection 1h…) nhưng có 4 chỗ BỊ LỠ:
 *   1. heat.states/strikes — chỉ dọn lười khi guild có vi phạm mới (flushGuild)
 *      → entry nguội của guild im lặng tồn tại MÃI.
 *   2. burstTracker (altDetection) — guild rời vẫn giữ { joins: [...] } mãi.
 *   3. voicePresenceMap (index.js) — rời voice có dọn, nhưng guild bot bị kick
 *      thì toàn bộ Map con treo vĩnh viễn.
 *   4. cache config (convex.js) — guild rời vẫn giữ config trong cache TTL mãi.
 *
 * Thiết kế: MỘT vòng lặp 10 phút gọi các sweeper đăng ký — mỗi sweeper tự biết
 * cách dọn vùng của mình và PHẢI O(đã dọn được). Mọi sweeper bọc try/catch:
 * lỗi dọn dẹp KHÔNG BAO GIỜ làm sập bot. Không thay thế sweeper cũ (vẫn hữu
 * ích cho dữ liệu nóng) — chỉ vá những chỗ rơi ra ngoài.
 */

/** @type {Array<{ name: string, fn: () => number | void }>} */
const sweepers = [];

/** Đăng ký một sweeper. Trả về số entry đã dọn (để log gọn gàng). */
function registerSweeper(name, fn) {
  sweepers.push({ name, fn });
}

/** Chạy MỘT lượt dọn toàn bộ. Trả về tổng entry đã dọn. */
function sweepAll() {
  let total = 0;
  const parts = [];
  for (const { name, fn } of sweepers) {
    try {
      const n = fn();
      if (typeof n === "number" && n > 0) {
        total += n;
        parts.push(`${name}=${n}`);
      }
    } catch (e) {
      // Dọn dẹp fail không được giết bot — chỉ ghi log để biết mà sửa.
      console.error(`[memGuard] sweeper ${name} lỗi:`, e?.message || e);
    }
  }
  if (total > 0) console.log(`[memGuard] đã dọn ${total} entry (${parts.join(", ")})`);
  return total;
}

/** Khởi động vòng lặp định kỳ (mặc định 10 phút). Trả về hàm dừng — cho test. */
function startMemGuard(intervalMs = 10 * 60_000) {
  const timer = setInterval(() => {
    try {
      sweepAll();
    } catch {
      // impossible — sweepAll đã bọc từng sweeper; phòng thủ thêm cho chắc.
    }
  }, intervalMs);
  timer.unref?.();
  return () => clearInterval(timer);
}

module.exports = { registerSweeper, sweepAll, startMemGuard };
