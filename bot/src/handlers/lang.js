"use strict";
/**
 * lang.js — Tự động chọn ngôn ngữ theo QUỐC GIA của server (guild locale).
 *
 * Discord cung cấp `guild.preferredLocale` (locale người chủ server chọn —
 * thực chất phản ánh quốc gia/ngôn ngữ cộng đồng). Bot không cần hỏi ai:
 *   - Locale thuộc ngôn ngữ bot hỗ trợ (vi, en, de) → dùng ngay.
 *   - Quốc gia KHÁC (ja, ko, ru, fr, es-BR…) → mặc định EN (tiếng Anh là
 *     lingua franca — đúng yêu cầu "các nước chưa có ngôn ngữ riêng → EN").
 *
 * Ứng dụng:
 *   - welcome/goodbye: tin nhắn chào/tạm biệt đúng ngôn ngữ cộng đồng.
 *   - incidentReport (AI): báo cáo tình hình server viết theo ngôn ngữ server.
 *
 * Thiết kế lá (0 I/O, 0 token): map thuần, không phụ thuộc Discord SDK,
 * test được hermetic hoàn toàn.
 */

/** Ngôn ngữ bot hỗ trợ bản dịch UI + template đi kèm. */
const SUPPORTED = new Set(["vi", "en", "de"]);

/**
 * Map locale Discord → ngôn ngữ.
 * Discord locale gồm cả nhóm ngôn ngữ (vi, ja, ko, zh-CN…) và biến thể vùng
 * (en-US, pt-BR, es-ES…). Ta chỉ quan tâm PHẦN NGÔN NGỮ (trước gạch nối).
 */
function langForLocale(locale) {
  const raw = String(locale || "").trim();
  if (!raw) return "vi"; // server không đặt locale → sản phẩm gốc tiếng Việt
  // Chuẩn hoá: "en-US" → "en", "pt-BR" → "pt" (locale Discord dùng "-" hoặc "_").
  const base = raw.toLowerCase().split(/[-_]/)[0];
  if (SUPPORTED.has(base)) return base;
  // en-* (en-GB, en-AU…) đã gộp ở base === "en" phía trên.
  // Mọi quốc gia chưa được hỗ trợ bản dịch riêng → EN mặc định.
  return "en";
}

/**
 * Ngôn ngữ cho một guild — biến locale tùy chọn (guild thật hay test mock).
 * guild.preferredLocale có thể là string hoặc object { code } (tùy phiên bản
 * discord.js) → đọc cả hai dạng, không crash với dữ liệu lạ.
 */
function langForGuild(guildLike) {
  const raw = guildLike?.preferredLocale;
  const code = typeof raw === "string" ? raw : typeof raw?.code === "string" ? raw.code : "";
  return langForLocale(code);
}

/**
 * Template welcome/goodbye theo ngôn ngữ. VI giữ nguyên bản gốc (sản phẩm);
 * DE + EN là bản dịch; ngôn ngữ khác không xảy ra ở đây (đã quy về EN/DE/VI).
 */
const WELCOME_TEMPLATES = {
  vi: "Chào mừng {user} đã đến **{server}**! Bạn là thành viên thứ {count} 🎉",
  en: "Welcome {user} to **{server}**! You are member #{count} 🎉",
  de: "Willkommen {user} auf **{server}**! Du bist Mitglied #{count} 🎉",
};
const GOODBYE_TEMPLATES = {
  vi: "{user} đã rời **{server}**. Hẹn gặp lại!",
  en: "{user} has left **{server}**. See you again!",
  de: "{user} hat **{server}** verlassen. Bis bald!",
};

/** Template mặc định welcome theo ngôn ngữ server. */
function welcomeDefault(lang) {
  return WELCOME_TEMPLATES[lang] || WELCOME_TEMPLATES.en;
}
/** Template mặc định goodbye theo ngôn ngữ server. */
function goodbyeDefault(lang) {
  return GOODBYE_TEMPLATES[lang] || GOODBYE_TEMPLATES.en;
}

/**
 * Nhãn in lên THẺ ẢNH chào/tạm biệt theo ngôn ngữ server.
 * Font nhúng chỉ có chữ Latin + dấu tiếng Việt (không có emoji/kana) nên nhãn ở
 * đây phải thuần chữ — emoji sẽ bị welcomeCard bỏ khỏi ảnh.
 */
const CARD_LABELS = {
  vi: { welcome: "CHÀO MỪNG", goodbye: "TẠM BIỆT", member: "Thành viên thứ {count}" },
  en: { welcome: "WELCOME", goodbye: "GOODBYE", member: "Member #{count}" },
  de: { welcome: "WILLKOMMEN", goodbye: "AUF WIEDERSEHEN", member: "Mitglied #{count}" },
};

/** Nhãn thẻ theo ngôn ngữ server (lạ → EN). */
function cardLabels(lang) {
  return CARD_LABELS[lang] || CARD_LABELS.en;
}

/**
 * NGÔN NGỮ THEO TỪNG NGƯỜI DÙNG (dùng cho ticket) — ưu tiên NGƯỜI hơn SERVER.
 *
 * Vì sao không dùng IP: Discord KHÔNG BAO GIỜ cấp IP người dùng cho bot
 * (chính vì vậy tầng "VPN detection" ở altDetection.js đã bị gỡ — dòng
 * "Discord does NOT expose real IPs"). Tín hiệu per-user Discord CẤP cho
 * bot là locale client của người đó:
 *   - `interaction.locale` — ngôn ngữ client khi bấm nút (chính xác nhất).
 *   - `user.locale` — ngôn ngữ tài khoản Discord (đọc được khi chỉ có user).
 * Thứ tự: interaction → user → guild → VI.
 *
 * `guild` là tuỳ chọn: nơi gọi chỉ có user (DM cho người bị ban) vẫn chạy
 * được, chỉ mất tầng dự phòng guild.
 */
function langForUser(interactionOrUser, guildLike = null) {
  const i = interactionOrUser;
  // Interaction: locale (người bấm) được ưu tiên tuyệt đối.
  if (i && typeof i.locale === "string" && i.locale) return langForLocale(i.locale);
  const user = i && i.user ? i.user : i;
  if (user && typeof user.locale === "string" && user.locale) return langForLocale(user.locale);
  if (guildLike) return langForGuild(guildLike);
  return "vi";
}

/** Nhãn 2 loại ticket theo ngôn ngữ (ticket "khiếu nại" vs "hỗ trợ chung"). */
const TICKET_KINDS = {
  vi: {
    appeal: "Khiếu nại",
    support: "Hỗ trợ chung",
  },
  en: { appeal: "Appeal", support: "General support" },
  de: { appeal: "Beschwerde", support: "Allgemeiner Support" },
};

/** Nhãn loại ticket (lạ → EN). */
function ticketKind(lang, kind) {
  const table = TICKET_KINDS[lang] || TICKET_KINDS.en;
  return table[kind] || TICKET_KINDS.en[kind] || kind;
}

/**
 * Chuỗi ticket theo ngôn ngữ NGƯỜI DÙNG.
 *
 * Ghi chú bảo mật: chuỗi nào dán vào embed KÊNH đều đã escape mention ở
 * `ticketCore.js` (`escapeMentions`) — bảng này chỉ chứa phần cứng.
 */
const TICKET_TEXT = {
  vi: {
    openedTitle: "Khiếu nại #{n}",
    supportTitle: "Hỗ trợ #{n}",
    openedBy: "Người mở",
    type: "Loại",
    status: "Trạng thái",
    body: "Nội dung",
    evidence: "Bằng chứng",
    noEvidence: "—",
    staffOnboard:
      "Staff: hãy phản hồi trực tiếp trong kênh này. Người dùng cần giải đáp hoặc muốn báo cáo chuyện gì — kể cả báo cáo về chính bot.",
    // Nút
    btnClose: "Đóng",
    btnUnban: "Gỡ ban",
    btnPin: "Ghim",
    btnAi: "Ghi chú AI",
    // Modal
    modalTitle: "Mở khiếu nại",
    modalAppealLabel: "Bạn cho rằng mình bị phạt oan vì…",
    modalEvidenceLabel: "Bằng chứng hoặc tên người bị cho là có (tuỳ chọn)",
    // Lỗi / phản hồi
    errDisabled: "❌ Tính năng ticket đang tắt trên server này.",
    errNoCategory: "❌ Chủ server chưa cấu hình nơi chứa ticket.",
    errNoPerm: "❌ Bot cần quyền **Quản lý kênh** để mở ticket.",
    errBotAccount: "❌ Tài khoản bot không thể mở ticket.",
    errNoGuild: "❌ Lệnh này chỉ hoạt động trong server.",
    errBanned:
      "❌ Bạn đang bị ban nên không thể dùng lệnh này. Nếu đã nhận DM từ bot, hãy bấm nút **Mở khiếu nại** trong đó.",
    errCooldown: "⏳ Bạn vừa mở ticket. Hãy chờ khoảng {h} giờ rồi thử lại.",
    errMaxOpen:
      "❌ Server hiện đang có {n} ticket mở — vượt giới hạn ({max}). Vui lòng chờ staff xử lý.",
    errAlreadyOpen: "ℹ️ Bạn đã có một ticket đang mở: {ch}.",
    errHierarchy: "❌ Bot cần role cao hơn bạn để cấp quyền xem kênh ticket.",
    errChannelsFull: "❌ Server đã đạt giới hạn 500 kênh của Discord — không thể tạo ticket mới.",
    errNoStaff: "❌ Chủ server chưa cấu hình role staff xử lý ticket.",
    errLocked: "🔒 Server đang bị khoá do raid — không thể mở ticket lúc này.",
    errUnknown: "❌ Không mở được ticket — chủ server hãy kiểm tra lại cấu hình.",
    okOpened: "✅ Đã mở ticket: {ch}",
    okSent: "✅ Đã gửi khiếu nại. Ban quản trị sẽ xem và phản hồi.",
    dmFailed: "⚠️ Không gửi được DM (bạn có thể đã tắt tin nhắn riêng từ server).",
    closedTitle: "Đã đóng",
    closedBy: "Đóng bởi",
    closeNote: "Ghi chú khi đóng",
    unbannedNote: "✅ Đã gỡ ban cho {user}.",
    notBanned: "ℹ️ {user} hiện không bị ban trong server này.",
    aiLabel: "Ghi chú của staff",
    aiPlaceholder: "Tóm tắt ngắn tình hình (tiếng Việt hoặc ngôn ngữ bạn muốn)…",
    aiThinking: "🧠 AI đang đọc ticket…",
    aiEmpty: "Cần nội dung để AI đọc.",
    closedNotice: "🔒 Ticket đã đóng. Bạn không thể gửi tin nhắn nữa.",
  },
  en: {
    openedTitle: "Appeal #{n}",
    supportTitle: "Support #{n}",
    openedBy: "Opened by",
    type: "Type",
    status: "Status",
    body: "Message",
    evidence: "Evidence",
    noEvidence: "—",
    staffOnboard:
      "Staff: reply here. The member needs an answer or wants to report something — including the bot itself.",
    btnClose: "Close",
    btnUnban: "Unban",
    btnPin: "Pin",
    btnAi: "AI note",
    modalTitle: "Open an appeal",
    modalAppealLabel: "Why do you think this punishment was a mistake?",
    modalEvidenceLabel: "Evidence or the name you were accused of (optional)",
    errDisabled: "❌ Tickets are turned off on this server.",
    errNoCategory: "❌ The server owner has not set a ticket category yet.",
    errNoPerm: "❌ The bot needs **Manage Channels** to open tickets.",
    errBotAccount: "❌ Bot accounts cannot open tickets.",
    errNoGuild: "❌ This command only works inside a server.",
    errBanned:
      "❌ You are banned from this server, so you cannot use this command. If the bot sent you a DM, press **Open appeal** there.",
    errCooldown: "⏳ You opened a ticket recently. Please try again in about {h} hour(s).",
    errMaxOpen:
      "❌ This server has {n} open ticket(s) — over the limit ({max}). Please wait for staff.",
    errAlreadyOpen: "ℹ️ You already have an open ticket: {ch}.",
    errHierarchy: "❌ The bot needs a higher role than you to grant channel access.",
    errChannelsFull: "❌ This server hit Discord's 500 channel limit — cannot create a ticket.",
    errNoStaff: "❌ The server owner has not set a staff role for tickets.",
    errLocked: "🔒 The server is locked during a raid — tickets cannot be opened right now.",
    errUnknown: "❌ Could not open a ticket — the server owner should double-check the settings.",
    okOpened: "✅ Ticket opened: {ch}",
    okSent: "✅ Appeal sent. The moderators will review and reply.",
    dmFailed: "⚠️ Could not send a DM (you may have server DMs turned off).",
    closedTitle: "Closed",
    closedBy: "Closed by",
    closeNote: "Closing note",
    unbannedNote: "✅ Unbanned {user}.",
    notBanned: "ℹ️ {user} is not currently banned in this server.",
    aiLabel: "Staff note",
    aiPlaceholder: "Short summary of the situation (any language)…",
    aiThinking: "🧠 AI is reading the ticket…",
    aiEmpty: "Nothing for the AI to read.",
    closedNotice: "🔒 This ticket is closed. You can no longer send messages here.",
  },
  de: {
    openedTitle: "Beschwerde #{n}",
    supportTitle: "Support #{n}",
    openedBy: "Eröffnet von",
    type: "Typ",
    status: "Status",
    body: "Nachricht",
    evidence: "Beweis",
    noEvidence: "—",
    staffOnboard:
      "Staff: hier antworten. Das Mitglied braucht eine Antwort oder möchte etwas melden — auch den Bot selbst.",
    btnClose: "Schließen",
    btnUnban: "Entbannen",
    btnPin: "Anheften",
    btnAi: "KI-Notiz",
    modalTitle: "Beschwerde eröffnen",
    modalAppealLabel: "Warum war diese Bestrafung Ihrer Meinung nach ein Fehler?",
    modalEvidenceLabel: "Beweis oder der Name, dem Sie vorgeworfen wurden (optional)",
    errDisabled: "❌ Tickets sind auf diesem Server deaktiviert.",
    errNoCategory: "❌ Der Serverbesitzer hat noch keine Ticket-Kategorie festgelegt.",
    errNoPerm: "❌ Der Bot braucht **Kanäle verwalten**, um Tickets zu eröffnen.",
    errBotAccount: "❌ Bot-Konten können keine Tickets eröffnen.",
    errNoGuild: "❌ Dieser Befehl funktioniert nur auf einem Server.",
    errBanned:
      "❌ Du bist auf diesem Server gesperrt und kannst den Befehl nicht nutzen. Falls der Bot dir eine DM geschickt hat, drücke dort auf **Beschwerde eröffnen**.",
    errCooldown:
      "⏳ Du hast kürzlich ein Ticket eröffnet. Bitte versuche es in etwa {h} Stunde(n) erneut.",
    errMaxOpen:
      "❌ Auf diesem Server sind {n} Ticket(s) offen — über dem Limit ({max}). Bitte warte auf das Team.",
    errAlreadyOpen: "ℹ️ Du hast bereits ein offenes Ticket: {ch}.",
    errHierarchy: "❌ Der Bot braucht eine höhere Rolle als du, um Kanalzugriff zu geben.",
    errChannelsFull: "❌ Dieser Server hat das Discord-Limit von 500 Kanälen erreicht.",
    errNoStaff: "❌ Der Serverbesitzer hat noch keine Staff-Rolle für Tickets festgelegt.",
    errUnknown:
      "❌ Ticket konnte nicht eröffnet werden — der Serverbesitzer sollte die Einstellungen prüfen.",
    errLocked:
      "🔒 Der Server ist wegen eines Raids gesperrt — Tickets können gerade nicht eröffnet werden.",
    okOpened: "✅ Ticket eröffnet: {ch}",
    okSent: "✅ Beschwerde gesendet. Die Moderation prüft sie und antwortet.",
    dmFailed: "⚠️ DM konnte nicht gesendet werden (Server-DMs sind evtl. deaktiviert).",
    closedTitle: "Geschlossen",
    closedBy: "Geschlossen von",
    closeNote: "Abschlussnotiz",
    unbannedNote: "✅ {user} wurde entbannt.",
    notBanned: "ℹ️ {user} ist derzeit nicht auf diesem Server gesperrt.",
    aiLabel: "Team-Notiz",
    aiPlaceholder: "Kurze Zusammenfassung der Lage (beliebige Sprache)…",
    aiThinking: "🧠 Die KI liest das Ticket…",
    aiEmpty: "Nichts für die KI zum Lesen.",
    closedNotice: "🔒 Dieses Ticket ist geschlossen. Du kannst hier keine Nachrichten mehr senden.",
  },
};

/**
 * Chuỗi ticket theo ngôn ngữ (lạ → EN).
 *
 * Hàm thuần trả OBJECT MỚI mỗi lần? Không — trả chính object trong bảng.
 * Vì sao an toàn: các chỗ dùng đều chỉ ĐỌC, không ghi. Nếu sau này có chỗ nào
 * ghi vào, phải `Object.freeze` hoặc copy — ghi chú này để không ai patch bằng
 * cách mutate thầm lặng.
 */
function ticketText(lang) {
  return TICKET_TEXT[lang] || TICKET_TEXT.en;
}

module.exports = {
  SUPPORTED,
  langForLocale,
  langForGuild,
  langForUser,
  welcomeDefault,
  goodbyeDefault,
  cardLabels,
  ticketKind,
  ticketText,
  TICKET_KINDS,
  TICKET_TEXT,
};
