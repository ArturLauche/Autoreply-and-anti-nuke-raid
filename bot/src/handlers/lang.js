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

module.exports = {
  SUPPORTED,
  langForLocale,
  langForGuild,
  welcomeDefault,
  goodbyeDefault,
  cardLabels,
};
