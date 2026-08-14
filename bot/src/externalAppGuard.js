/**
 * External App Guard — các hàm thuần (không phụ thuộc discord.js) dùng để phát
 * hiện RAID bằng ỨNG DỤNG NGOÀI (external app / integration) và các biến thể
 * tương tự. Tách riêng để dễ test (scripts/test-external-app-guard.cjs) và để
 * bot + AI dùng chung một bộ tín hiệu.
 */

// Từ khóa scam phổ biến trong các vụ raid bằng app ngoài (nitro/giveaway/boost/crypto...).
const SCAM_WORD_RE =
  /(nitro|giveaway|boost|free|claim|reward|prize|winner|crypto|bitcoin|airdrop|verify|earn|click|limited|exclusive|gift|hack)/i;
// Link mời Discord.
const INVITE_RE = /(discord\.(gg|com\/invite|app\.com\/invite)|discordapp\.com\/invite)/i;
// Link rút gọn / kênh ngoài thường dùng để dẫn lừa đảo.
const SHORTLINK_RE = /(bit\.ly|tinyurl\.com|rb\.gy|cutt\.ly|t\.me\/|rebrand\.ly|is\.gd|shorturl\.at|goo\.gl)/i;
// App nổi tiếng thường bị giả mạo tên (kèm từ phụ) để lừa chủ server cài app độc.
const IMPERSONATED_APPS = [
  "mee6", "dyno", "carl-bot", "carlbot", "carl bot", "tatsu", "mudae", "probot", "wumpus",
  "discord", "protection", "protector", "security", "antinuke", "anti-nuke", "guard",
  "moderation", "xenon", "statbot", "top.gg", "disboard", "arc", "reaction role", "leveling",
  "welcome", "captcha", "verify", "nitro", "giveaway",
];

/**
 * Dấu vân tay nội dung tin nhắn (text + embed: title/description/footer/fields) —
 * bắt cả spam chỉ gửi embed hoặc kèm thay đổi nhỏ (vd timestamp) mà text trống.
 */
function messageFingerprint(msg) {
  return [
    msg.content || "",
    ...(msg.embeds || []).map((e) =>
      [
        e.title,
        e.description,
        e.footer?.text,
        ...(e.fields || []).map((f) => `${f.name}: ${f.value}`),
      ]
        .filter(Boolean)
        .join(" | "),
    ),
  ]
    .join("\n")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 500);
}

/** Chuẩn hóa nội dung để so khớp "gần giống": lowercase, bỏ URL/mention/emoji/số/dấu câu. */
function normalizeFuzzy(text) {
  return String(text || "")
    .toLowerCase()
    .replace(/https?:\/\/\S+/g, " ")
    .replace(/<@[!&]?\d+>/g, " ")
    .replace(/<#\d+>/g, " ")
    .replace(/[\u{1F000}-\u{1FAFF}\u{2600}-\u{27BF}\u{FE0F}\u{200D}]/gu, " ")
    .replace(/[^a-z0-9à-ỹ\s]/gi, " ")
    .replace(/\b\d+\b/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** Độ phủ token (Jaccard) giữa 2 nội dung đã chuẩn hóa. */
function tokenOverlap(a, b) {
  if (!a || !b) return 0;
  const sa = new Set(a.split(" ").filter(Boolean));
  const sb = new Set(b.split(" ").filter(Boolean));
  if (sa.size === 0 || sb.size === 0) return 0;
  let inter = 0;
  for (const t of sa) if (sb.has(t)) inter++;
  return inter / (sa.size + sb.size - inter);
}

/**
 * Hai nội dung đã chuẩn hóa có phải "gần giống" không (lặp có biến thể nhỏ:
 * đổi số/emoji/URL mỗi tin để né filter)? Yêu cầu CHẶT để không phạt nhầm bot
 * quen thuộc (nhạc/leveling) — vd "now playing: song A" vs "now playing: song B":
 *   - cả 2 đều dài ít nhất 4 token (tin quá ngắn chỉ tính trùng giống hệt fp)
 *   - ít nhất 4 token chung
 *   - độ phủ token >= 0.8
 */
function isNearDuplicate(a, b) {
  if (!a || !b) return false;
  const sa = new Set(a.split(" ").filter(Boolean));
  const sb = new Set(b.split(" ").filter(Boolean));
  if (sa.size < 4 || sb.size < 4) return false;
  let inter = 0;
  for (const t of sa) if (sb.has(t)) inter++;
  const overlap = inter / (sa.size + sb.size - inter);
  return overlap >= 0.8 && inter >= 4;
}

/**
 * Mức độ nghi vấn của TÊN app ngoài (chạy deterministic, không cần AI):
 *   +3 tên chứa từ khóa scam (nitro/giveaway/boost/free/verify/crypto...)
 *   +3 tên giả mạo app nổi tiếng (tên quen + từ phụ: "MEE6 Pro", "Dyno Premium", "Carl-Bot Hack"...)
 *   +1 tên dạng máy (chữ + đuôi số dài hoặc toàn số — app sinh hàng loạt)
 * Trả { score, parts }.
 */
function appNameSuspicion(appName) {
  const name = String(appName || "").toLowerCase().trim();
  if (!name) return { score: 0, parts: [] };
  const clean = name.replace(/[^a-z0-9]+/g, "");
  let score = 0;
  const parts = [];
  if (SCAM_WORD_RE.test(name)) {
    score += 3;
    parts.push("tên chứa từ khóa scam");
  }
  for (const known of IMPERSONATED_APPS) {
    const k = known.replace(/[^a-z0-9]+/g, "");
    if (!k || k.length < 3) continue;
    if (clean.includes(k)) {
      // Tên khớp 1:1 app nổi tiếng = app thật; chỉ nghi khi có thêm từ phụ (pro/premium/free/hack/beta...).
      const extra = clean.replace(k, "").replace(/[^a-z0-9]+/g, "");
      if (extra.length > 0) {
        score += 3;
        parts.push(`giả mạo app "${known}"`);
      }
      break;
    }
  }
  if (/^[a-z]+\d{4,}$/.test(clean) || /^\d{5,}$/.test(clean)) {
    score += 1;
    parts.push("tên dạng máy");
  }
  return { score, parts };
}

/**
 * Tín hiệu spam của ỨNG DỤNG NGOÀI trong cửa sổ module:
 *  1) Nội dung lặp giống hệt (kể cả embed) >= 2 lần → spam rõ ràng.
 *  2) Nội dung GẦN GIỐNG (chuẩn hóa, độ phủ >= 0.8 + >= 4 token chung + tin dài đủ)
 *     >= 2 lần → biến thể né filter (đổi số/emoji/URL mỗi tin) vẫn bị bắt.
 *  3) Vượt ngưỡng KÈM tín hiệu quảng cáo: link mời Discord, link rút gọn, @everyone/@here
 *     hoặc từ khóa scam → quảng cáo server kiểu raid.
 *  4) App gửi >= max(ngưỡng, 4) tin → flood, không cần nội dung trùng nhau.
 * Bot quen thuộc gửi vài tin khác nhau liên tiếp không bị phạt nhầm.
 */
function isExternalAppSpam({ samples, currentFingerprint, count, threshold, hay }) {
  const sameFingerprint = samples.filter((e) => e.fp && e.fp === currentFingerprint).length;
  const norm = normalizeFuzzy(currentFingerprint);
  const similar = norm
    ? samples.filter((e) => isNearDuplicate(e.norm || normalizeFuzzy(e.fp), norm)).length
    : 0;
  const hasInvite = INVITE_RE.test(hay);
  const hasShortlink = SHORTLINK_RE.test(hay);
  const hasEveryone = /(@everyone|@here)/i.test(hay);
  const scamHits = (hay.match(SCAM_WORD_RE) || []).length;
  const urlCount = (hay.match(/https?:\/\/\S+/gi) || []).length;
  const floodCount = Math.max(threshold, 4);
  return {
    triggered:
      sameFingerprint >= 2 ||
      similar >= 2 ||
      (count >= threshold && (hasInvite || hasShortlink || hasEveryone || scamHits >= 2)) ||
      count >= floodCount,
    sameFingerprint,
    similar,
    hasInvite,
    hasShortlink,
    hasEveryone,
    scamHits,
    urlCount,
    floodCount,
  };
}

module.exports = {
  SCAM_WORD_RE,
  INVITE_RE,
  SHORTLINK_RE,
  IMPERSONATED_APPS,
  messageFingerprint,
  normalizeFuzzy,
  tokenOverlap,
  isNearDuplicate,
  appNameSuspicion,
  isExternalAppSpam,
};
