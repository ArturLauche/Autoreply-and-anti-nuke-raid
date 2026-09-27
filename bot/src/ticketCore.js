"use strict";
/**
 * ticketCore.js — HÀM THUẦN của tính năng ticket (khiếu nại + hỗ trợ chung).
 *
 * Vì sao tách file: phần tạo kênh / bấm nút phải cần `discord.js` và gateway,
 * nên không test được hermetic. Mọi quyết định THUẦN — tên kênh hợp lệ, có
 * được mở ticket không, cắt/escape nội dung người dùng, dựng payload embed —
 * nằm ở đây để `scripts/test-tickets.cjs` chạy không cần mạng, không cần mock
 * Discord. Đúng kiểu `convex/guildConfig.ts` tách hàm thuần khỏi phần gọi db.
 *
 * ⚠️ BẢO MẬT — escapeMentions là hàng rào CHỐNG PING, không phải chi tiết đẹp:
 * nội dung người dùng sẽ được dán vào embed trong kênh ticket. Không escape
 * thì 1 người gõ `@everyone` trong khiếu nại là ping cả server. Vì vậy MỌI
 * đường đi nội dung người dùng vào embed đều bắt buộc qua `escapeMentions`.
 *
 * ⚠️ VÌ SAO MỌI KÝ TỰ ĐẶC BIỆT Ở ĐÂY ĐỀU VIẾT BẰNG ESCAPE `\uXXXX`:
 * ký tự vô hình (U+200B) và dấu thanh tổ hợp (U+0300–U+036F) rất dễ bị
 * editor/sed/tooling nuốt mất — đã xảy ra đúng một lần trong lúc viết file
 * này: hằng `ZERO_WIDTH` thành chuỗi rỗng và `escapeMentions` biến thành hàm
 * NO-OP (tức là mất hoàn toàn hàng rào chống ping). Dùng escape ASCII thì mắt
 * không thấy gì nhưng byte luôn đúng, và test hermetic bắt được ngay.
 */

/** Chữ cái/số được giữ lại trong tên kênh (ASCII, lowercase, và `-` `_`). */
const CHANNEL_NAME_KEEP = /[^a-z0-9_-]+/g;

/** Tên kênh Discord dài tối đa 100 ký tự. */
const CHANNEL_NAME_MAX = 100;

/** Nội dung khiếu nại cắt tối đa 1000 ký tự (giới hạn Discord embed field). */
const BODY_MAX = 1000;

/** Bằng chứng cắt tối đa 500 ký tự. */
const EVIDENCE_MAX = 500;

/** Mặc định khi cấu hình thiếu — SỐ LẺ để lỗi cấu hình không khoá cứng server. */
const DEFAULTS = {
  maxOpen: 20,
  cooldownHours: 24,
};

/** Ký tự zero-width space (U+200B) — viết bằng escape, xem ghi chú đầu file. */
const ZERO_WIDTH = String.fromCharCode(0x200b);

/**
 * Chèn zero-width vào giữa ký hiệu mention để Discord không nhận ra.
 *
 * Vì sao ZWSP chứ không phải backslash: Discord escape bằng `\@` là thứ user
 * tự gõ được, ai cũng bypass được. ZWSP làm "chữ" trong mention, nên text vẫn
 * đọc gần như nguyên vẹn mà không ping ai.
 *
 * Phủ: @everyone, @here, <@id> / <@!id> (mention user), <@&id> (mention role).
 */
function escapeMentions(text) {
  if (text === null || text === undefined) return "";
  return String(text)
    .replace(/@(everyone|here)/g, `@${ZERO_WIDTH}$1`)
    .replace(/<@!?\d+>/g, (m) => `<@${ZERO_WIDTH}${m.slice(2)}`)
    .replace(/<@&\d+>/g, (m) => `<@&${ZERO_WIDTH}${m.slice(3)}`);
}

/** Cắt chuỗi kèm dấu "…" khi bị cắt. */
function clip(text, max) {
  const s = String(text ?? "");
  if (s.length <= max) return s;
  return `${s.slice(0, Math.max(0, max - 1))}…`;
}

/**
 * Chuẩn hoá + escape nội dung người dùng trước khi nhét vào embed.
 *
 * Luôn escape (kể cả khi không cắt) — hai việc độc lập, gộp vào một hàm để
 * không ai gọi `clip` mà quên `escapeMentions`.
 */
function sanitizeBody(text, max = BODY_MAX) {
  return clip(escapeMentions(text).trim(), max);
}

/**
 * Bỏ dấu thanh tổ hợp (chuẩn hoá NFD rồi xoá U+0300–U+036F và U+1AB0–U+1AFF).
 *
 * Vì sao cần: tên kênh Discord chỉ nhận `a-z0-9_-`; "khiếu nại" có `ế` là
 * không hợp lệ. Phải NFD TRƯỚC rồi xoá dấu — thứ tự ngược lại sẽ nuốt mất
 * chữ gốc.
 *
 * Ghi chú: `đ`/`Đ` KHÔNG tách được bằng NFD (nó là một chữ riêng U+0110/U+0111
 * chứ không phải base+dấu) → xử lý riêng trong `sanitizeChannelName`.
 */
function stripDiacritics(s) {
  return String(s ?? "")
    .normalize("NFD")
    .replace(/[̀-ͯ᪰-᫿]/g, "");
}

/** Chuẩn hoá tên kênh về đúng luật Discord. */
function sanitizeChannelName(name, max = CHANNEL_NAME_MAX) {
  let out = stripDiacritics(name)
    .toLowerCase()
    .replace(/đ/g, "d")
    .replace(CHANNEL_NAME_KEEP, "-")
    .replace(/-+/g, "-") // gộp gạch liên tiếp (Discord từ chối "--")
    .replace(/^[-_]+/, "") // không bắt đầu bằng - hoặc _
    .replace(/[-_]+$/, "") // không kết thúc bằng - hoặc _
    .slice(0, max)
    .replace(/[-_]+$/, ""); // cắt có thể để lại gạch ở cuối → dọn lần nữa
  if (!out) out = "ticket";
  return out;
}

/** Tên kênh ticket: `ticket-<số>` hoặc `<tên user đã bỏ dấu>-<số>`. */
function buildChannelName({ username, number, prefix = "ticket" }) {
  // KHÔNG dùng fallback "ticket" của sanitizeChannelName làm `who`: nếu
  // username rỗng thì tên ra "ticket-ticket-7" (đã xảy ra, test bắt được).
  // Ở đây chỉ cần biết "có dùng được tên không", nên tự kiểm.
  const raw = String(username ?? "").trim();
  const who = raw ? sanitizeChannelName(raw) : "";
  // Bỏ tiền tố trùng lặp: username đã là "ticket-…" thì không lặp thêm.
  const base = who.startsWith(`${prefix}-`) ? who.slice(prefix.length + 1) : who;
  const tail = String(number ?? "").trim() || "1";
  return sanitizeChannelName(base ? `${prefix}-${base}-${tail}` : `${prefix}-${tail}`);
}

/** Ép số cấu hình về khoảng hợp lệ; rác → `fallback`. */
function normalizeLimit(value, fallback, min, max) {
  const n = Number(value);
  if (!Number.isFinite(n)) return fallback;
  return Math.max(min, Math.min(max, Math.round(n)));
}

/**
 * Quyết định có cho mở ticket không.
 *
 * @param {object} args
 * @param {boolean} args.enabled       cấu hình ticketEnabled
 * @param {string|null} args.category  ticketCategoryId
 * @param {string[]} args.staffRoleIds role nào được coi là staff
 * @param {number} args.openCount      số ticket `open` của server
 * @param {number|null} args.lastOpenedAt mở lần trước của chính người này
 * @param {number} args.maxOpen        ticketMaxOpen
 * @param {number} args.cooldownHours  ticketCooldownHours
 * @param {number} args.now            inject để test không phụ thuộc Date
 * @returns {{ok: true} | {ok: false, reason: string, waitHours?: number, max?: number}}
 *
 * Thứ tự kiểm tra CỐ Ý: cấu hình → hàng rào chống spam → người dùng. Lý do:
 * người gọi nên thấy "chủ server chưa cấu hình" trước "bạn vừa mở ticket" —
 * lỗi cấu hình là lỗi chủ server, không phải lỗi người dùng.
 */
function decideOpen({
  enabled,
  category,
  staffRoleIds = [],
  openCount = 0,
  lastOpenedAt = null,
  maxOpen = DEFAULTS.maxOpen,
  cooldownHours = DEFAULTS.cooldownHours,
  now = Date.now(),
}) {
  if (!enabled) return { ok: false, reason: "disabled" };
  if (!category) return { ok: false, reason: "no_category" };
  if (!Array.isArray(staffRoleIds) || staffRoleIds.length === 0) {
    return { ok: false, reason: "no_staff" };
  }
  const cap = normalizeLimit(maxOpen, DEFAULTS.maxOpen, 1, 100);
  const cool = normalizeLimit(cooldownHours, DEFAULTS.cooldownHours, 0, 720);
  if (openCount >= cap) return { ok: false, reason: "max_open", max: cap };
  if (cool > 0 && lastOpenedAt) {
    const elapsedHours = (now - lastOpenedAt) / 3_600_000;
    if (elapsedHours < cool) {
      return { ok: false, reason: "cooldown", waitHours: Math.ceil(cool - elapsedHours) };
    }
  }
  return { ok: true };
}

/**
 * Chuẩn hoá giá trị người dùng bấm nút thành 1 trong 2 loại ticket.
 *
 * `support` là loại CHUNG — hỏi đáp, cần giải đáp, báo cáo bất kỳ chuyện gì
 * (kể cả báo cáo chính bot). `appeal` dành riêng cho khiếu nại hình phạt.
 * Giá trị lạ → `support` vì đó là loại tồn tại mọi lúc, không cần bật riêng.
 */
function normalizeKind(kind) {
  return kind === "appeal" ? "appeal" : "support";
}

/** Người dùng có quyền staff theo danh sách role không. */
function isStaff(member, staffRoleIds) {
  if (!member) return false;
  const ids = Array.isArray(staffRoleIds) ? staffRoleIds : [];
  if (ids.length === 0) return false;
  // `member.roles.cache` là Collection; đọc `.has` nếu có, không ép theo mảng
  // để test dùng mảng thuần cũng chạy được.
  const roles = member.roles?.cache || member.roles;
  if (roles && typeof roles.has === "function") return ids.some((id) => roles.has(id));
  if (Array.isArray(roles)) return ids.some((id) => roles.includes(id));
  return false;
}

/**
 * Dựng payload embed mở ticket — TRẢ OBJECT THUẦN, không phải EmbedBuilder.
 *
 * Vì sao không EmbedBuilder: hàm thuần thì test được. `tickets.js` bọc object
 * này vào `new EmbedBuilder(payload)` ở bước sau.
 *
 * `TICKET_TEXT` là bảng chuỗi đã dịch; nội dung người dùng đã escape qua
 * `sanitizeBody` trước khi tới đây.
 */
function buildOpenPayload({
  TICKET_TEXT: T,
  number,
  kind,
  openerName,
  openedById = null,
  body,
  evidence,
}) {
  const num = String(number);
  return {
    title: (normalizeKind(kind) === "appeal" ? T.openedTitle : T.supportTitle).replace("{n}", num),
    fields: [
      {
        name: T.openedBy,
        value: openedById ? `<@${openedById}>\n${openerName}` : openerName,
        inline: true,
      },
      { name: T.status, value: num, inline: true },
      { name: T.body, value: body || "—", inline: false },
      { name: T.evidence, value: evidence || T.noEvidence, inline: false },
    ],
    footer: T.staffOnboard,
  };
}

/** Số phút chờ còn lại của cooldown (làm tròn lên để hiển thị). */
function cooldownMinutesLeft(lastOpenedAt, cooldownHours, now = Date.now()) {
  if (!lastOpenedAt || cooldownHours <= 0) return 0;
  const total = cooldownHours * 60;
  const elapsed = (now - lastOpenedAt) / 60_000;
  return Math.max(0, Math.ceil(total - elapsed));
}

module.exports = {
  BODY_MAX,
  EVIDENCE_MAX,
  CHANNEL_NAME_MAX,
  DEFAULTS,
  ZERO_WIDTH,
  escapeMentions,
  clip,
  sanitizeBody,
  stripDiacritics,
  sanitizeChannelName,
  buildChannelName,
  decideOpen,
  normalizeLimit,
  normalizeKind,
  isStaff,
  buildOpenPayload,
  cooldownMinutesLeft,
};
