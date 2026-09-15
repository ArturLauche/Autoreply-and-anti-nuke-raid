/**
 * actionBudget.js — Trần tổng hành động phạt TỰ ĐỘNG mỗi guild.
 *
 * Vấn đề: khi một trận nuke kích nhiều module cùng lúc (spam + massMessage +
 * blankNoise + antinuke + heat leo thang), các module có thể phản ứng dây chuyền
 * và phạt hàng chục tài khoản/phút — kể cả khi phần lớn là dương tính giả.
 * Budget đặt trần số punish tự động (warn/timeout/kick/ban) trong 1 phút/guild:
 * vượt trần → bỏ qua hình phạt (vẫn ghi nhận sự kiện/log như bình thường ở nơi gọi).
 *
 * Thiết kế:
 *  - In-memory, cửa sổ trượt 60 giây — burst raid là hiện tượng ngắn, không cần
 *    persist; restart làm reset budget = fail-open có chủ đích (sau restart bot
 *    ưu tiên phản ứng lại trận raid thay vì tê liệt).
 *  - FAIL-OPEN: mọi lỗi nội tại → cho phép phạt. An toàn hơn là chặn nhầm khi
 *    đang bị nuke thật.
 *  - Chỉ giới hạn hành động TỰ ĐỘNG của bot — mod bấm ban thủ công không bị ràng.
 *  - Chỉnh per-guild: config.actionBudgetPerMinute (1–200, mặc định 20).
 */
const DEFAULT_LIMIT = 20;
const WINDOW_MS = 60_000;
/** Trần số guild giữ trong bộ nhớ — chống rò rỉ RAM khi bot rời hàng trăm server. */
const MAX_GUILDS = 500;

/** guildId -> mảng timestamp các lần phạt (tăng dần). */
const hits = new Map();

/** Đọc trần từ config — giá trị rác/không hợp lệ → mặc định. */
function budgetLimitFor(config) {
  try {
    const n = Number(config?.actionBudgetPerMinute);
    if (!Number.isFinite(n) || n < 1) return DEFAULT_LIMIT;
    return Math.min(200, Math.max(1, Math.floor(n)));
  } catch {
    return DEFAULT_LIMIT;
  }
}

function prune(list, now) {
  while (list.length > 0 && now - list[0] >= WINDOW_MS) list.shift();
}

/**
 * Guild còn được phạt tự động không? `config` tùy chọn (để caller có sẵn config
 * truyền vào — không tạo thêm lượt đọc Convex).
 */
function canPunish(guildId, config, now = Date.now()) {
  try {
    const limit = budgetLimitFor(config);
    const list = hits.get(guildId);
    if (!list) return true;
    prune(list, now);
    return list.length < limit;
  } catch {
    return true; // fail-open
  }
}

/** Ghi nhận 1 lần phạt tự động (đếm cả khi Discord API lỗi — chống vòng lặp retry). */
function recordPunish(guildId, now = Date.now()) {
  try {
    let list = hits.get(guildId);
    if (!list) {
      list = [];
      hits.set(guildId, list);
    }
    prune(list, now);
    list.push(now);
    // Dọn guild cũ: guild rời server không còn sự kiện để dọn tự nhiên.
    if (hits.size > MAX_GUILDS) {
      for (const [gid, l] of hits) {
        prune(l, now);
        if (l.length === 0 && gid !== guildId) hits.delete(gid);
      }
    }
  } catch {
    // never throw — budget không được phép làm vỡ luồng phạt
  }
}

/** Số lần phạt trong cửa sổ hiện tại (cho /heat status, dashboard, test). */
function usage(guildId, now = Date.now()) {
  try {
    const list = hits.get(guildId);
    if (!list) return 0;
    prune(list, now);
    return list.length;
  } catch {
    return 0;
  }
}

/** Xóa budget của 1 guild (test, hoặc dashboard reset). */
function resetGuild(guildId) {
  try {
    hits.delete(guildId);
  } catch {
    // never throw
  }
}

module.exports = { canPunish, recordPunish, usage, resetGuild, budgetLimitFor, DEFAULT_LIMIT };
