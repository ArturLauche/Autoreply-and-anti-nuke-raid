/**
 * relayClient.js — Threat Relay phía bot (Đợt 6).
 *
 *  - Tải signature chia sẻ từ các server khác (mỗi 10 phút, fire-and-forget —
 *    lỗi relay KHÔNG BAO GIỜ làm fail quét tin nhắn).
 *  - Bắn signature khi AI xác nhận raid (spam-text) hoặc bot nuke lạ được thêm
 *    (bot-name) — chỉ khi guild ĐÃ bật relayShare (Convex kiểm tra lại).
 *
 * Signature nhận về được filters.js dùng TRƯỚC AI classify: nếu nội dung khớp
 * signature raid đã được server khác xác nhận (weight >= 2 hoặc < 2h tuổi) thì
 * khớp ngay — server mới "có miễn dịch cộng đồng" không phải chờ học.
 *
 * Fail-open tuyệt đối: mọi lỗi → bỏ qua im lặng (chỉ console.warn), filters vẫn
 * chạy deterministic path như chưa từng có relay.
 */
const RELAY_REFRESH_MS = 10 * 60 * 1000;
/** Signature nhận về tối đa giữ trong RAM. */
const MAX_LOCAL = 100;

let store = null;
let lastFetchAt = 0;
let loading = false;
/** Mảng { kind, value, weight } từ relay — bot đang bật relayReceive. */
let signatures = [];

/** Gắn store (gọi 1 lần khi bot ready). */
function attach(storeRef) {
  store = storeRef;
}

/** Bắn 1 signature lên relay (fire-and-forget, không bao giờ throw). */
function reportSignature(guildId, kind, value) {
  try {
    if (!store || !guildId || !value) return;
    store.client
      .mutation("relay:botReportSignature", { guildId, kind, value: String(value).slice(0, 60) })
      .catch(() => {});
  } catch {
    // never throw
  }
}

/** Bắn hàng loạt (ví dụ samples spam của 1 vụ raid) — dedupe trước khi gửi. */
function reportSignatureBatch(guildId, kind, values) {
  try {
    const uniq = [
      ...new Set((values || []).map((v) => String(v ?? "").trim()).filter(Boolean)),
    ].slice(0, 10);
    for (const v of uniq) reportSignature(guildId, kind, v);
  } catch {
    // never throw
  }
}

/**
 * Tải signature về (fire-and-forget). Gọi từ filters.refreshThreatIntel cùng nhịp
 * 10 phút — dùng chung TTL để không thêm call Convex.
 */
function refreshSignatures(guildId) {
  try {
    if (!store || !guildId || loading) return;
    if (Date.now() - lastFetchAt < RELAY_REFRESH_MS) return;
    loading = true;
    store.client
      .query("relay:botGetRelaySignatures", { guildId })
      .then((res) => {
        if (res && Array.isArray(res.signatures)) {
          signatures = res.signatures.slice(0, MAX_LOCAL);
          lastFetchAt = Date.now();
        }
      })
      .catch(() => {})
      // Dọn rác relay định kỳ (mutation riêng — query không xóa được). Fire-and-forget.
      .then(() => store.client.mutation("relay:botCleanupRelay", {}).catch(() => {}))
      .finally(() => {
        loading = false;
      });
  } catch {
    loading = false;
  }
}

/**
 * Khớp nội dung tin nhắn với signature spam-text đã nhận. Trả signature khớp
 * hoặc null. Signature là chuỗi đã chuẩn hóa phía Convex (≤60 ký tự) — so khớp
 * substring lower-case, đủ an toàn (không regex từ dữ liệu mạng).
 */
function matchSpamText(content) {
  try {
    if (signatures.length === 0 || !content) return null;
    const lower = String(content).toLowerCase();
    for (const sig of signatures) {
      if (sig.kind !== "spam-text") continue;
      const v = String(sig.value || "").toLowerCase();
      if (v.length >= 3 && lower.includes(v)) return sig;
    }
  } catch {
    return null; // fail-open: dữ liệu lạ → không khớp
  }
  return null;
}

/** Số signature đang giữ (cho test/đếm). */
function localCount() {
  return signatures.length;
}

/** Xóa cache local (test). */
function reset() {
  signatures = [];
  lastFetchAt = 0;
}

module.exports = {
  attach,
  reportSignature,
  reportSignatureBatch,
  refreshSignatures,
  matchSpamText,
  localCount,
  reset,
};
