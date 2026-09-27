/**
 * syncState — trạng thái đồng bộ giữa web và bot, để NGƯỜI DÙNG BIẾT CHÍNH
 * XÁC bot đang chạy cấu hình nào.
 *
 * Vì sao cần: dashboard hiện giá trị vừa lưu, trông như đã có hiệu lực. Nhưng
 * bot đọc cấu hình qua cache TTL 30 phút (`bot/src/convex.js`); cơ chế
 * `settingsChangedAt` + `bot_tick:getPendingJobs` rút xuống còn ~3 phút. Người
 * dùng sửa xong, thấy web vẫn hiện giá trị mới, tưởng bot đang chạy nó — rồi
 * báo "bot chưa chạy". Chính là ảo giác đã gây bug 23/09.
 *
 * QUY TẮC KHÔNG NÓI DỐI: ở đây KHÔNG có tín hiệu "bot đã áp dụng" từ phía bot
 * (bot chỉ xoá cache, không ghi mốc ngược lại). Nên ta KHÔNG báo "đã áp dụng".
 * Ta chỉ báo điều có thể chứng minh được: vừa sửa → bot đang nhận; quá thời
 * gian nhận → đã gửi; bot offline → không ai chạy được. Nói "đã áp dụng" khi
 * không có bằng chứng là tự tạo lại đúng loại ảo giác này.
 *
 * Hàm thuần để test khoá đúng biên thời gian.
 */

/** Bot tick 180s + nghẽn nhịp → 3 phút là mốc "chắc chắn đã tới bot". */
export const SETTINGS_APPLY_WINDOW_MS = 3 * 60_000;
/** Quá 10 phút mà bot vẫn không báo mình sống → coi như offline, nói thẳng. */
export const STALE_HEARTBEAT_MS = 10 * 60_000;

export type SyncState = "just-saved" | "sent" | "bot-offline" | "in-sync";

/**
 * @param settingsChangedAt lúc web ghi cấu hình (undefined = chưa từng sửa)
 * @param botOnline          bot còn sống không
 * @param lastHeartbeat      lần heartbeat gần nhất của bot
 */
export function syncState(input: {
  settingsChangedAt?: number | null;
  botOnline: boolean;
  lastHeartbeat?: number | null;
  now?: number;
}): SyncState {
  const now = input.now ?? Date.now();
  const changedAt = input.settingsChangedAt ?? 0;

  // Bot không sống thì không có gì "đồng bộ" được — nói rõ thay vì im lặng.
  if (!input.botOnline) return "bot-offline";
  if (changedAt <= 0) return "in-sync";

  const elapsed = now - changedAt;
  // Mốc thời gian chưa tới: nói "đang nhận" chứ đừng vời xong.
  if (elapsed < SETTINGS_APPLY_WINDOW_MS) return "just-saved";
  // Heartbeat quá cũ trong lúc có cấu hình mới → coi như bot không còn sống.
  if (typeof input.lastHeartbeat === "number" && now - input.lastHeartbeat > STALE_HEARTBEAT_MS) {
    return "bot-offline";
  }
  return "sent";
}
