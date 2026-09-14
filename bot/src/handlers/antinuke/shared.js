"use strict";
/**
 * Pure functions + constants của Anti Nuke — không phụ thuộc runtime Discord,
 * test trực tiếp được. (Giữ nguyên từ đầu bản monolith, path require đã sửa.)
 */
const { PermissionFlagsBits, UserFlags } = require("discord.js");
const { messageFingerprint, isExternalAppSpam } = require("../../externalAppGuard");

const MODULE_LABELS = {
  massBan: "Ban hàng loạt",
  massKick: "Kick hàng loạt",
  massJoin: "Raid thành viên",
  massChannelCreate: "Tạo kênh hàng loạt",
  massChannelDelete: "Xóa kênh hàng loạt",
  massRoleCreate: "Tạo role hàng loạt",
  massRoleDelete: "Xóa role hàng loạt",
  massMessageDelete: "Xóa tin hàng loạt",
  massWebhookCreate: "Tạo webhook hàng loạt",
  massThreadCreate: "Tạo thread hàng loạt",
  massThreadDelete: "Xóa thread hàng loạt",
  massChannelRename: "Sửa/đổi tên kênh hàng loạt",
  massChannelOverwrite: "Thay đổi quyền kênh hàng loạt",
  massRoleEdit: "Sửa role hàng loạt",
  adminSelfGrant: "Tự cấp quyền quản trị",
  massRoleAssign: "Gán/gỡ role hàng loạt",
  massNickname: "Đổi biệt danh hàng loạt",
  massEmoji: "Tạo emoji/sticker hàng loạt",
  massBotAdd: "Thêm bot hàng loạt",
  botHitAndRun: "Bot vào-rồi-rời (hit-and-run)",
  suspiciousBotAlert: "Bot lạ mới vào server",
  externalAppRaid: "Raid bằng ứng dụng ngoài (External App)",
  massInviteCreate: "Tạo link mời hàng loạt",
  guildTamper: "Đổi cấu hình server",
  raidIntel: "Raid Intel — ban nguồn cơn",
  spam: "Chống spam tin nhắn",
  massMessage: "Spam tin dài / lặp nội dung",
  blankNoise: "Tin giả blank gây nhiễu",
  badword: "Từ ngữ xấu",
  attachment: "Spam ảnh/file đính kèm",
  invite: "Link mời Discord",
  malware: "Link độc hại & file nguy hiểm",
};

// Các bot logging/app phổ biến tạo webhook hợp pháp → bỏ qua massWebhookCreate
const KNOWN_LOGGING_BOTS = [
  "carl-bot",
  "carlbot",
  "carl bot",
  "mee6",
  "dyno",
  "tatsu",
  "probot",
  "wumpus bot",
  "wick",
  "security bot",
  "auto moderador",
  "statbot",
  "arcane",
  "top.gg bot",
  "disboard",
  "xenon",
  "sapphire",
];

function isKnownLoggingBot(executor) {
  // Chuẩn hóa: lowercase + bỏ dấu ngăn cách (-, _, space) rồi so CHÍNH XÁC —
  // so khớp includes trước đây bị lách bằng tên giả "carlbotfan"/"freecarlbot"
  // (bot nuke mượn tên bot logging để được bỏ qua toàn bộ anti-nuke).
  const norm = (s) => (s || "").toLowerCase().replace(/[-_\s]+/g, "");
  const known = new Set(KNOWN_LOGGING_BOTS.map(norm));
  return known.has(norm(executor?.username)) || known.has(norm(executor?.tag));
}

// Module nuke/raid: phạt trực tiếp, KHÔNG cộng nhiệt (chỉ có hình phạt gốc).
const NUKE_MODULES = new Set([
  "massBan",
  "massKick",
  "massJoin",
  "massChannelCreate",
  "massChannelDelete",
  "massRoleCreate",
  "massRoleDelete",
  "massMessageDelete",
  "massWebhookCreate",
  "massThreadCreate",
  "massThreadDelete",
  "massChannelRename",
  "massChannelOverwrite",
  "massRoleEdit",
  "adminSelfGrant",
  "massRoleAssign",
  "massNickname",
  "massEmoji",
  "massBotAdd",
  "botHitAndRun",
  "externalAppRaid",
  "massInviteCreate",
  "guildTamper",
]);

// Bot gây hại: các module phá hủy cấu trúc này KHÔNG cần chờ đủ ngưỡng khi thủ
// phạm là bot — bot làm 1 lần đã là nuke (khác người dùng có thể thao tác nhầm).
// Bot logging hợp pháp (Carl-bot, MEE6...) vẫn được lọc riêng ở massWebhookCreate.
const IMMEDIATE_BOT_NUKE = new Set([
  "massBan",
  "massKick",
  "massChannelDelete",
  "massChannelCreate",
  "massRoleDelete",
  "massRoleCreate",
  "massMessageDelete",
  "massThreadDelete",
  "massThreadCreate",
  "massWebhookCreate",
  "adminSelfGrant",
  "massBotAdd",
  "botHitAndRun",
  "externalAppRaid",
]);

/**
 * Bot hit-and-run: bot MỚI được thêm vào server rồi TỰ RỜI ngay — dấu hiệu
 * kinh điển của bot nuke (thực hiện phá hoại rồi rời để dọn dấu vết, né audit
 * log và né lệnh phạt). Pure function, test được.
 * CHỈ tính là hit-and-run khi: rời đúng là bot, khoảng thêm→rời trong cửa sổ,
 * và bot KHÔNG tin cậy (không tick xác minh). Mod/bot khác kick (có audit
 * MemberKick) và bot logging hợp pháp được loại ở tầng gọi.
 */
const HIT_AND_RUN_WINDOW_MS = 10 * 60_000; // 10 phút

/**
 * Phân loại bot MỚI ĐƯỢC THÊM vào server (pure function, test được):
 * - "logging"  : bot logging hợp pháp theo tên (Carl-bot, MEE6…) → bỏ qua.
 * - "verified" : có tick VerifiedBot của Discord → bỏ qua.
 * - "unknown"  : bot lạ — đáng cảnh báo. Kèm cờ youngAcc (acc < 30 ngày)
 *   để cảnh báo mạnh hơn (bot nuke thường dùng acc/bot application mới tạo).
 */
function strangeBotVerdict({ user, now = Date.now() }) {
  if (!user || user.bot !== true) return { alert: false, kind: "not-bot" };
  if (isKnownLoggingBot(user)) return { alert: false, kind: "logging" };
  const verified = typeof user.flags?.has === "function" && user.flags.has(UserFlags.VerifiedBot);
  if (verified) return { alert: false, kind: "verified" };
  const ageDays = user.createdAt ? (now - user.createdAt) / 86_400_000 : NaN;
  const youngAcc = Number.isFinite(ageDays) && ageDays < 30;
  return { alert: true, kind: youngAcc ? "unknown-young" : "unknown", youngAcc };
}
function botHitAndRunVerdict({ addedAt, leftAt, trusted, isBot }) {
  if (!isBot) return false;
  if (!addedAt) return false;
  if (leftAt - addedAt > HIT_AND_RUN_WINDOW_MS) return false;
  if (trusted) return false;
  return true;
}

/**
 * Bot THÀNH VIÊN LÂU NĂM / XÁC MINH — coi như bot hợp lệ được mời chính thức.
 * Bot hợp lệ (Carl-bot, Dyno, MEE6, Wick, Security bot…) cũng BAN bot spam,
 * PURGE tin nhắn, TẠO/XÓA webhook — đây là công việc logging/moderation bình
 * thường, KHÔNG phải nuke. Trước đây mọi bot trigger module trong
 * IMMEDIATE_BOT_NUKE bị ban ngay ở lần đầu (ngưỡng 1) → ban oan bot xác minh.
 * Quy tắc mới: bot chỉ bị xử lý NGAY khi nó MỚI vào server (một trong các dấu
 * hiệu bot nuke: vừa được thêm + hành vi phá hủy tức thì). Bot đã ở lại server
 * lâu (>= 7 ngày) hoặc có tick VerifiedBot → đi theo NGƯỠNG BÌNH THƯỜNG của
 * module như người dùng (thủ phạm thật vẫn bị phạt, không còn ban oan).
 */
const TRUSTED_BOT_MIN_AGE_MS = 7 * 86_400_000;

/** Bot thành viên được coi là tin cậy: tick xác minh hoặc đã ở lại server >= 7 ngày. */
function isTrustedBotMember(member, guild) {
  if (!member) return false;
  const user = member.user ?? member;
  if (user?.bot !== true) return false;
  // Bot xác minh bởi Discord (tick) — luôn tin cậy.
  if (typeof user.flags?.has === "function" && user.flags.has(UserFlags.VerifiedBot)) return true;
  // Bot đã ở lại server đủ lâu = được mời từ trước, không phải bot nuke vừa được thêm.
  const joinedAt = member.joinedTimestamp;
  if (typeof joinedAt === "number" && Date.now() - joinedAt >= TRUSTED_BOT_MIN_AGE_MS) return true;
  // Fallback: guild.members.cache có sẵn thông tin join time đầy đủ hơn.
  const cached = guild?.members?.cache?.get(member.id);
  if (
    cached &&
    typeof cached.joinedTimestamp === "number" &&
    Date.now() - cached.joinedTimestamp >= TRUSTED_BOT_MIN_AGE_MS
  ) {
    return true;
  }
  return false;
}

/**
 * Người DÙNG được miễn xử lý cho 1 module? (pure function, test được)
 * Người admin thật được miễn thao tác quản trị thường ngày; còn BOT có quyền
 * Administrator thì KHÔNG được miễn — bot nuke được mời với quyền admin
 * chính là đối tượng cần cấm, không phải "quản trị viên tin cậy".
 * Whitelist role/người dùng (toàn cục hoặc theo module) vẫn được tôn trọng
 * kể cả với bot — owner chủ động whitelist là quyết định cuối cùng.
 */
function isExempt(member, moduleCfg, guildConfig) {
  if (!member) return false;
  // An toàn kiểu: executor từ audit log là User (không có .guild/.roles) —
  // truy cập liều lĩnh trước đây làm crash cả handler → mất luôn lệnh phạt.
  const isBotMember = member.user?.bot === true || member.bot === true;
  if (member.guild?.ownerId && member.id === member.guild.ownerId) return true;
  if (!isBotMember && member.permissions?.has?.(PermissionFlagsBits.Administrator)) return true;
  if ((guildConfig?.adminRoles || []).some((id) => member.roles?.cache.has(id))) return true;
  if ((guildConfig?.modRoles || []).some((id) => member.roles?.cache.has(id))) return true;
  // Whitelist toàn cục: role/người dùng được miễn trừ khỏi mọi module nuke/raid/moderation.
  if ((guildConfig?.whitelistRoles || []).some((id) => member.roles?.cache.has(id))) return true;
  if ((guildConfig?.whitelistUsers || []).includes(member.id)) return true;
  if ((moduleCfg?.whitelistRoles || []).some((id) => member.roles?.cache.has(id))) return true;
  return false;
}

// Ký tự ẩn thường dùng để gây nhiễu.
const ZERO_WIDTH_RE = /[\u200b-\u200d\u2060\ufeff]/g;
// Ngưỡng độ dài coi là "tin dài cực dài" (Discord giới hạn 2000 ký tự).
const LONG_MSG_LEN = 300;
// Kích thước tối đa của các bucket trong bộ nhớ (chống rò rỉ RAM).
const BUCKET_MAX = 200;

/**
 * Cấu hình mặc định cho các module MỚI — server cũ chưa có dòng antinukeModules
 * (chưa được seed) vẫn bật module với ngưỡng mặc định, giống hành vi web
 * (AntiNukePanel configFor fallback). Khi mod lưu từ dashboard, dòng sẽ được tạo.
 */
const DEFAULT_MODULE_CFG = {
  massThreadDelete: { threshold: 3, windowSeconds: 10, punish: "ban", timeoutSeconds: 600 },
  massChannelRename: { threshold: 3, windowSeconds: 10, punish: "ban", timeoutSeconds: 600 },
  massChannelOverwrite: { threshold: 3, windowSeconds: 10, punish: "ban", timeoutSeconds: 600 },
  massRoleEdit: { threshold: 3, windowSeconds: 10, punish: "ban", timeoutSeconds: 600 },
  adminSelfGrant: { threshold: 1, windowSeconds: 10, punish: "ban", timeoutSeconds: 600 },
  massRoleAssign: { threshold: 6, windowSeconds: 15, punish: "kick", timeoutSeconds: 600 },
  massNickname: { threshold: 6, windowSeconds: 15, punish: "kick", timeoutSeconds: 600 },
  massEmoji: { threshold: 3, windowSeconds: 10, punish: "ban", timeoutSeconds: 600 },
  massBotAdd: { threshold: 3, windowSeconds: 10, punish: "kick", timeoutSeconds: 600 },
  // botHitAndRun CỐ Ý không có fallback mặc định — module mới phải qua botEnsureModules
  // (mặc định TẮT) và chủ server tự bật, đúng nguyên tắc "update không đổi setup cũ".
  externalAppRaid: { threshold: 2, windowSeconds: 15, punish: "kick", timeoutSeconds: 600 },
  massInviteCreate: { threshold: 5, windowSeconds: 10, punish: "ban", timeoutSeconds: 600 },
  guildTamper: { threshold: 2, windowSeconds: 10, punish: "ban", timeoutSeconds: 600 },
};

/** Lấy cấu hình module (đã seed) hoặc mặc định cho module mới chưa được seed. */
function moduleCfgOf(config, module) {
  const found = (config?.modules || []).find((m) => m.module === module);
  if (found) return found;
  const d = DEFAULT_MODULE_CFG[module];
  if (!d) return null;
  return { module, enabled: true, ...d, whitelistRoles: [], actions: [d.punish] };
}

/**
 * Điểm nghi vấn của MỘT tài khoản trong cụm raid (pure function, test được):
 * acc mới <7 ngày (+2), avatar mặc định (+1), username dạng máy "tên + số cuối" (+1).
 * Mức CỤM (joinClusterSuspicion): điểm >= 2 = đáng ngờ (đủ acc mới là đủ tín hiệu cụm).
 * Mức CÁ NHÂN (kick từng người trong cụm hỗn hợp): điểm >= 3 — tức acc mới PHẢI kèm
 * thêm ít nhất 1 tín hiệu nữa (avatar mặc định / username máy). Chỉ riêng "acc mới"
 * chưa đủ để kick: người thật mới tạo tài khoản cũng có acc <7 ngày.
 */
function memberSuspicionScore(p, now = Date.now()) {
  if (!p || !p.id) return 0;
  let score = 0;
  const ageDays = p.createdAt ? (now - p.createdAt) / 86_400_000 : NaN;
  if (Number.isFinite(ageDays) && ageDays < 7) score += 2;
  if (!p.avatar) score += 1;
  if (/^[A-Za-z][A-Za-z0-9_]*\d{3,}$/.test(p.username || "")) score += 1;
  return score;
}

/**
 * Heuristic chống ban nhầm làn sóng thành viên THẬT (pure function, test được):
 * raid thật dùng tài khoản mới (< 7 ngày), avatar mặc định, username dạng máy.
 * Cụm tăng trưởng tự nhiên (server viral, được quảng bá) có hồ sơ bình thường
 * → ratio đáng ngờ thấp → bot bỏ qua thay vì kick cả server oan.
 * Tài khoản đáng ngờ = điểm >= 2 (xem memberSuspicionScore).
 */
function joinClusterSuspicion(profiles, now = Date.now()) {
  const list = (profiles || []).filter((p) => p && p.id);
  let freshAccounts = 0;
  let defaultAvatars = 0;
  let machineNames = 0;
  let suspicious = 0;
  for (const p of list) {
    const score = memberSuspicionScore(p, now);
    const ageDays = p.createdAt ? (now - p.createdAt) / 86_400_000 : NaN;
    if (Number.isFinite(ageDays) && ageDays < 7) freshAccounts += 1;
    if (!p.avatar) defaultAvatars += 1;
    if (/^[A-Za-z][A-Za-z0-9_]*\d{3,}$/.test(p.username || "")) machineNames += 1;
    if (score >= 2) suspicious += 1;
  }
  return {
    total: list.length,
    suspicious,
    ratio: list.length > 0 ? suspicious / list.length : 0,
    freshAccounts,
    defaultAvatars,
    machineNames,
  };
}

// Các hàm thuần (messageFingerprint, isExternalAppSpam, appNameSuspicion, normalizeFuzzy)
// được tách sang ../externalAppGuard để test trực tiếp — xem require ở đầu file.

module.exports = {
  MODULE_LABELS,
  KNOWN_LOGGING_BOTS,
  isKnownLoggingBot,
  NUKE_MODULES,
  IMMEDIATE_BOT_NUKE,
  strangeBotVerdict,
  botHitAndRunVerdict,
  isTrustedBotMember,
  isExempt,
  DEFAULT_MODULE_CFG,
  moduleCfgOf,
  memberSuspicionScore,
  joinClusterSuspicion,
  messageFingerprint,
  isExternalAppSpam,
  BUCKET_MAX,
  LONG_MSG_LEN,
  ZERO_WIDTH_RE,
};
