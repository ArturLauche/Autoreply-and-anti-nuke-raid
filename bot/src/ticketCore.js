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

/* ══════════════════════════════════════════════════════════════════════
   TỰ ĐÓNG — phần thuần (đợt nâng cấp)
   ══════════════════════════════════════════════════════════════════════ */

/** Mặc định: không ai chat 24 giờ thì bot tự đóng. */
const IDLE_HOURS_DEFAULT = 24;

/** Trần 30 ngày — quá dài thì tiền điện kênh đến vô ích. */
const IDLE_HOURS_MAX = 720;

/** Sau khi đóng tay, giữ kênh 24h rồi mới lưu transcript + xoá. */
const CLOSE_GRACE_DEFAULT = 24;

/** Lý do đóng cắt tối đa 300 ký tự (khớp trần botCloseTicket bên Convex). */
const CLOSE_REASON_MAX = 300;

/**
 * Chuẩn hoá `ticketIdleHours`. 0 = TẮT HẲN (không tự đóng).
 *
 * Vì sao 0 hợp lệ: có chủ server muốn ticket sống tới khi staff đóng tay —
 * ép mọi server dùng tự đóng sẽ khiến họ tắt cả tính năng.
 */
function normalizeIdleHours(value) {
  const n = Math.floor(Number(value));
  if (!Number.isFinite(n) || n <= 0) return 0;
  return Math.min(IDLE_HOURS_MAX, n);
}

/** Chuẩn hoá `ticketCloseGraceHours`. Tối thiểu 1h — xoá ngay lập tức mất transcript. */
function normalizeGraceHours(value) {
  const n = Math.floor(Number(value));
  if (!Number.isFinite(n) || n < 1) return CLOSE_GRACE_DEFAULT;
  return Math.min(IDLE_HOURS_MAX, n);
}

/**
 * Ticket có đã quá hạn chưa.
 *
 * @param {object} t     bản ghi ticket (cần lastActivityAt, createdAt, status)
 * @param {number} idleHours  đã chuẩn hoá qua normalizeIdleHours
 * @param {number} now   mốc thời gian (mặc định Date.now())
 *
 * idleHours = 0 → LUÔN false (đã tắt). Chưa từng có hoạt động nào thì tính
 * từ createdAt — nếu không, ticket mở rồi không ai nói sẽ đóng ngay lập tức.
 */
function isIdleExpired(t, idleHours, now = Date.now()) {
  if (!t || t.status !== "open") return false;
  const hours = normalizeIdleHours(idleHours);
  if (hours <= 0) return false;
  const last = t.lastActivityAt || t.createdAt || 0;
  if (!last) return false;
  return now - last >= hours * 3_600_000;
}

/** Đã đủ giờ giữ kênh sau khi đóng để lưu transcript + xoá chưa. */
function isPurgeDue(t, graceHours, now = Date.now()) {
  if (!t || t.status !== "closed") return false;
  if (t.transcriptStorageId) return false; // đã lưu rồi — không xoá 2 lần
  const grace = normalizeGraceHours(graceHours);
  const closed = t.closedAt || 0;
  if (!closed) return false;
  return now - closed >= grace * 3_600_000;
}

/** Số giờ còn lại trước khi bị dọn (hiển thị cho staff, 0 = không có hạn). */
function purgeHoursLeft(t, graceHours, now = Date.now()) {
  if (!t || t.status !== "closed" || t.transcriptStorageId) return 0;
  const closed = t.closedAt || 0;
  if (!closed) return 0;
  const totalMin = normalizeGraceHours(graceHours) * 60;
  const elapsedMin = (now - closed) / 60_000;
  // Trả về GIỜ (đúng như tên hàm). Trước đây trả phút → panel hiện
  // "1380 giờ" cho một khoảng 24 giờ. Tính tròn LÊN để không bao giờ
  // hứa dọn sớm hơn thực tế.
  return Math.max(0, Math.ceil((totalMin - elapsedMin) / 60));
}

/* ══════════════════════════════════════════════════════════════════════
   PANEL TUỲ BIẾN
   ══════════════════════════════════════════════════════════════════════ */

/** Nội dung panel cắt tối đa 1000 ký tự (khớp trần validate ở Convex). */
const PANEL_MAX = 1000;

/**
 * Thay placeholder trong nội dung tuỳ biến của chủ server.
 *
 * Placeholder hỗ trợ: {user} tên người mở, {number} số ticket, {kind} loại,
 * {idle} số giờ tự đóng.
 *
 * ⚠️ BẮT BUỘC escape trước khi thay: nội dung này dán vào embed trong kênh
 * ticket. Chủ server gõ `@everyone` trong ô tuỳ chỉnh sẽ ping cả server mỗi
 * lần có người mở ticket — hàng rào chống ping áp cho cả chủ server.
 */
function fillPanelText(template, values, T = {}) {
  const src = String(template ?? "").trim();
  if (!src) return String(T.panelTitle || "").replace(/\{(\w+)\}/g, "");
  const safe = {
    user: escapeMentions(values?.user ?? ""),
    number: escapeMentions(String(values?.number ?? "")),
    kind: escapeMentions(String(values?.kind ?? "")),
    idle: escapeMentions(String(values?.idle ?? "")),
  };
  return escapeMentions(src)
    .slice(0, PANEL_MAX)
    .replace(/\{(\w+)\}/g, (m, key) => (key in safe ? safe[key] : m));
}

/**
 * Chuẩn hoá lý do đóng do staff gõ.
 *
 * Cắt 300 ký tự + escape mention: lý do này hiện trong embed VÀ được gửi DM
 * cho người mở. Không escape thì staff (vô tình) gõ `<@&id>` là bot ping role
 * đó trong tin nhắn riêng của người dùng.
 */
function sanitizeCloseReason(text) {
  return clip(escapeMentions(String(text ?? "").trim()), CLOSE_REASON_MAX);
}

/**
 * Danh sách mention role để tag khi mở ticket.
 *
 * Chỉ nhận snowflake hợp lệ, tối đa 3. Không cắt theo "tính hợp lệ" im lặng
 * mà không nói — người gọi sẽ tưởng role đã được tag.
 */
function buildRoleMentions(roleIds) {
  const out = [];
  const seen = new Set();
  for (const raw of Array.isArray(roleIds) ? roleIds : []) {
    const id = String(raw ?? "").trim();
    if (!/^\d{15,22}$/.test(id)) continue;
    if (seen.has(id)) continue;
    seen.add(id);
    out.push("<@&" + id + ">");
    if (out.length >= 3) break;
  }
  return out;
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
  IDLE_HOURS_DEFAULT,
  IDLE_HOURS_MAX,
  CLOSE_GRACE_DEFAULT,
  CLOSE_REASON_MAX,
  PANEL_MAX,
  normalizeIdleHours,
  normalizeGraceHours,
  isIdleExpired,
  isPurgeDue,
  purgeHoursLeft,
  fillPanelText,
  sanitizeCloseReason,
  buildRoleMentions,
};
