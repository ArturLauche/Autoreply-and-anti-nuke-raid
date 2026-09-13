const { AuditLogEvent, PermissionFlagsBits, Colors, UserFlags } = require("discord.js");const { logEmbed, sendLog } = require("../util");
const { sendCaseLog, CASE_LABEL } = require("../caseLog");
const { isLocked, markLocked, lockGuild, unlockGuild } = require("../lockdown");
const {
  heatSettings,
  punishMember,
  choosePunish,
  heatSummary,
} = require("../heat");
const { actionsOf, memberPunishOf, cleanupMessages } = require("../moduleActions");
const aiClient = require("../ai");
const { emergencyRaidAlert } = require("./incidentReport");
const {
  messageFingerprint,
  isExternalAppSpam,
  appNameSuspicion,
  normalizeFuzzy,
  isExternalAppTarget,
  componentText,
  buttonRaidSignal,
} = require("../externalAppGuard");

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
  'carl-bot', 'carlbot', 'carl bot',
  'mee6', 'dyno', 'tatsu', 'probot', 'wumpus bot',
  'wick', 'security bot', 'auto moderador',
  'statbot', 'arcane', 'top.gg bot',
  'disboard', 'xenon', 'sapphire',
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
  const verified =
    typeof user.flags?.has === "function" && user.flags.has(UserFlags.VerifiedBot);
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
  if (cached && typeof cached.joinedTimestamp === "number" && Date.now() - cached.joinedTimestamp >= TRUSTED_BOT_MIN_AGE_MS) {
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

// Tin nhắn "giả blank": chỉ gồm khoảng trắng / ký tự ẩn (zero-width) / xuống dòng.
const BLANK_ONLY_RE = /^[\s\u200b-\u200d\u2060\ufeff\u00a0]+$/;
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

module.exports = function createAntiNuke(client, store, heat) {
  /** Persist a punished event for the daily report. Fire-and-forget. */
  async function recordEvent(guildId, payload) {
    try {
      await store.client.mutation("bot_writes:botRecordAntinukeEvent", { guildId, ...payload });
    } catch (err) {
      console.error("[antinuke:record]", err.message);
    }
  }
  const buckets = new Map(); // `${guildId}:${module}` -> [timestamps]
  const joiners = new Map(); // guildId -> [{id, ts}]
  const spamBuckets = new Map(); // `${guildId}:${userId}` -> [timestamps]
  const patternBuckets = new Map(); // `${guildId}:${userId}:${pattern}` -> [timestamps]
  const recentMessages = new Map(); // `${guildId}:${userId}` -> [{content, ts}] (mẫu cho AI)
  const appEvents = new Map(); // guildId -> [{ts, appName, executorId, executorName}] (external app)
  const appMsgSamples = new Map(); // `${guildId}:${appId}` -> [{content, ts, id, channelId}] (spam message từ app)
  const buttonClickEvents = new Map(); // `${guildId}:${messageId}` -> {appId, channelId, clicks:[{userId, ts}]} (raid nút bấm)
  const lastConfigs = new Map(); // guildId -> config (đã đọc gần nhất)
  // Bot hit-and-run: `${guildId}:${botId}` -> addedAt (ms). Ghi khi BotAdd (audit log
  // guildMemberAdd của bot), xóa khi bot rời — nếu rời trong cửa sổ → botHitAndRun.
  const botAddTimes = new Map();
  // Chống log "chồng chặp" (trùng lặp):
  //  - appUserHandledAt: người dùng app vừa bị xử lý bởi 1 tầng (audit IntegrationCreate
  //    hoặc tầng tin nhắn app) trong cửa sổ → tầng còn lại bỏ qua, không phạt/log trùng.
  //  - lastExtAppProcessedAt: guild vừa xử lý 1 đợt kết nối app → IntegrationCreate kế tiếp
  //    trong cùng cửa sổ không log thành vụ mới (1 làn sóng = 1 sự kiện).
  //  - patternPunishedAt: vừa phạt pattern (tin dài/lặp/blank) → cooldown 1 cửa sổ, không
  //    re-trigger để khỏi ghi liên tiếp nhiều vụ cùng 1 người spam liên tục.
  const appUserHandledAt = new Map(); // `${guildId}:${userId}` -> ts
  const lastExtAppProcessedAt = new Map(); // guildId -> ts
  const patternPunishedAt = new Map(); // `${guildId}:${userId}:${module}` -> ts
  const buttonRaidHandledAt = new Map(); // `${guildId}:${msgId}` -> ts — debounce vụ bấm nút đã xử lý
  const staleUnlockSwept = new Set(); // guild key mốc đã quét (chống spam log mở khóa)
  const punishedRecently = new Map(); // `${guildId}:${module}:${userId}` -> ts (chống phạt/case lặp)

  function record(guildId, module, cfg) {
    const key = `${guildId}:${module}`;
    const arr = buckets.get(key) ?? [];
    const now = Date.now();
    arr.push(now);
    const cutoff = now - cfg.windowSeconds * 1000;
    const pruned = arr.filter((t) => t >= cutoff);
    buckets.set(key, pruned);
    return pruned.length;
  }

  /** Danh dau 1 vu da phat/hanh dong — window chong lap phat + lap case log. */
  function markHandled(guildId, module, userId, windowMs) {
    if (!userId) return;
    punishedRecently.set(`${guildId}:${module}:${userId}`, { ts: Date.now(), ms: windowMs });
    if (punishedRecently.size > 2000) {
      const now = Date.now();
      for (const [k, v] of punishedRecently) {
        if (now - v.ts > v.ms) punishedRecently.delete(k);
      }
    }
  }

  /** Da phat/hanh dong cho cung module + thu pham trong window chua? (chong log/case trung). */
  function wasHandled(guildId, module, userId) {
    if (!userId) return false;
    const hit = punishedRecently.get(`${guildId}:${module}:${userId}`);
    return !!hit && Date.now() - hit.ts < hit.ms;
  }

  function appUserHandledRecently(guildId, userId, windowMs) {
    if (!userId) return false;
    const ts = appUserHandledAt.get(`${guildId}:${userId}`);
    return !!ts && Date.now() - ts < windowMs;
  }

  function markAppUserHandled(guildId, userId) {
    if (!userId) return;
    appUserHandledAt.set(`${guildId}:${userId}`, Date.now());
  }

  /** Số thành viên mới vào server trong cửa sổ (đo làn sóng raid đang diễn ra). */
  function recentJoinCount(guildId, windowMs) {
    const arr = joiners.get(guildId) ?? [];
    const cutoff = Date.now() - windowMs;
    return arr.filter((j) => j.ts >= cutoff).length;
  }


  async function auditExecutor(guild, eventType, targetId) {
    try {
      const fetched = await guild.fetchAuditLogs({ type: eventType, limit: 5 });
      if (targetId) {
        const entry = fetched.entries.find((e) => e.target?.id === targetId);
        if (entry) return entry.executor;
      }
      const first = fetched.entries.first();
      return first ? first.executor : null;
    } catch {
      return null;
    }
  }

  /** Xác định người dùng đã TẠO webhook (audit log WebhookCreate) — để phạt đúng người kết nối app. */
  async function webhookCreator(guild, webhookId) {
    try {
      const fetched = await guild.fetchAuditLogs({ type: AuditLogEvent.WebhookCreate, limit: 10 });
      const entry = fetched.entries.find((e) => e.target?.id === webhookId);
      return entry?.executor ?? null;
    } catch {
      return null;
    }
  }

  /** Dọn bộ nhớ định kỳ: xóa entry cũ của guild đã rời / vượt cửa sổ. */
  function sweepMemory() {
    const now = Date.now();
    const live = new Set(client.guilds.cache.keys());
    for (const [key] of buckets) {
      const guildId = key.split(":")[0];
      if (!live.has(guildId)) buckets.delete(key);
    }
    // Chống rò rỉ RAM: ngoài việc xóa guild đã rời, còn loại luôn entry cũ
    // quá 10 phút của guild ĐANG hoạt động (trước đây cứ tích lại mãi).
    const stale = now - 600_000;
    for (const [guildId, arr] of joiners) {
      if (!live.has(guildId)) {
        joiners.delete(guildId);
        continue;
      }
      const fresh = arr.filter((j) => j.ts >= stale);
      if (fresh.length === 0) joiners.delete(guildId);
      else joiners.set(guildId, fresh);
    }
    for (const [key, ts] of botAddTimes) {
      if (now - ts > 900_000) botAddTimes.delete(key);
    }
    for (const [key, arr] of spamBuckets) {
      const guildId = key.split(":")[0];
      if (!live.has(guildId)) {
        spamBuckets.delete(key);
        continue;
      }
      const fresh = arr.filter((t) => t >= stale);
      if (fresh.length === 0) spamBuckets.delete(key);
      else spamBuckets.set(key, fresh);
    }
    for (const [key, arr] of patternBuckets) {
      const guildId = key.split(":")[0];
      if (!live.has(guildId)) {
        patternBuckets.delete(key);
        continue;
      }
      const fresh = arr.filter((t) => t >= stale);
      if (fresh.length === 0) patternBuckets.delete(key);
      else patternBuckets.set(key, fresh);
    }
    for (const [key, arr] of recentMessages) {
      const guildId = key.split(":")[0];
      if (!live.has(guildId)) {
        recentMessages.delete(key);
        continue;
      }
      const fresh = arr.filter((m) => now - m.ts < 60_000);
      if (fresh.length === 0) recentMessages.delete(key);
      else recentMessages.set(key, fresh);
    }
    for (const [guildId, arr] of appEvents) {
      if (!live.has(guildId)) {
        appEvents.delete(guildId);
        continue;
      }
      const fresh = arr.filter((e) => e.ts >= stale);
      if (fresh.length === 0) appEvents.delete(guildId);
      else appEvents.set(guildId, fresh);
    }
    for (const [key, arr] of appMsgSamples) {
      const guildId = key.split(":")[0];
      if (!live.has(guildId)) {
        appMsgSamples.delete(key);
        continue;
      }
      const fresh = arr.filter((e) => e.ts >= stale);
      if (fresh.length === 0) appMsgSamples.delete(key);
      else appMsgSamples.set(key, fresh);
    }
    for (const [key, bucket] of buttonClickEvents) {
      const guildId = key.split(":")[0];
      if (!live.has(guildId)) {
        buttonClickEvents.delete(key);
        continue;
      }
      const fresh = bucket.clicks.filter((c) => c.ts >= stale);
      if (fresh.length === 0) buttonClickEvents.delete(key);
      else buttonClickEvents.set(key, { ...bucket, clicks: fresh });
    }
    for (const [guildId] of lastConfigs) {
      if (!live.has(guildId)) lastConfigs.delete(guildId);
    }
    for (const [key, ts] of appUserHandledAt) {
      const guildId = key.split(":")[0];
      if (!live.has(guildId) || now - ts >= stale) appUserHandledAt.delete(key);
    }
    for (const [guildId, ts] of lastExtAppProcessedAt) {
      if (!live.has(guildId) || now - ts >= stale) lastExtAppProcessedAt.delete(guildId);
    }
    for (const [key, ts] of patternPunishedAt) {
      const guildId = key.split(":")[0];
      if (!live.has(guildId) || now - ts >= stale) patternPunishedAt.delete(key);
    }
    for (const [key, ts] of buttonRaidHandledAt) {
      const guildId = key.split(":")[0];
      if (!live.has(guildId) || now - ts >= stale) buttonRaidHandledAt.delete(key);
    }
    if (buckets.size > BUCKET_MAX) {
      // Giữ lại 200 key gần nhất (chống phình vô hạn)
      const keys = [...buckets.keys()].slice(0, buckets.size - BUCKET_MAX);
      for (const k of keys) buckets.delete(k);
    }
  }

  /** Gọi AI phân loại sự kiện raid vs cá nhân. Trả về null khi AI không có.
   *  Chạy TRỰC TIẾP từ process bot (bot/src/ai.js) — không tốn Convex actions.
   */
  async function aiClassify(guild, module, count, windowSeconds, threshold, samples) {
    try {
      if (!aiClient.aiAvailable()) return null;
      const recentJoins = joiners.get(guild.id)?.length ?? 0;
      const res = await Promise.race([
        aiClient.classifyViolation({
          module,
          count,
          windowSeconds,
          threshold,
          sampleMessages: samples,
          recentJoins,
          memberCount: guild.memberCount ?? undefined,
        }),
        new Promise((r) => setTimeout(() => r(null), 6000)),
      ]);
      if (!res || res.offline) return null;
      return res;
    } catch (err) {
      console.error("[ai:classify]", err.message);
      return null;
    }
  }

  /** Gọi AI phân tích cụm raid (best-effort, 6s timeout). Trả null khi AI offline.
   *  Chạy TRỰC TIẾP từ process bot — không tốn Convex actions.
   */
  async function aiAnalyzeRaid(guild, module, count, windowSeconds, threshold, clusterProfile, recentActions) {
    try {
      if (!aiClient.aiAvailable()) return null;
      const res = await Promise.race([
        aiClient.analyzeRaid({
          module,
          count,
          windowSeconds,
          threshold,
          clusterProfile: clusterProfile ? String(clusterProfile).slice(0, 1500) : undefined,
          recentActions: recentActions ? String(recentActions).slice(0, 1500) : undefined,
        }),
        new Promise((r) => setTimeout(() => r(null), 6000)),
      ]);
      if (!res || res.offline) return null;
      return res;
    } catch (err) {
      console.error("[ai:analyzeRaid]", err.message);
      return null;
    }
  }

  /** Gọi AI xác định chuỗi kết nối external app có phải raid không (best-effort, 6s timeout).
   *  Chạy TRỰC TIẾP từ process bot — không tốn Convex actions.
   */
  async function aiAnalyzeExternalApp(guild, count, windowSeconds, threshold, appProfile, recentJoins) {
    try {
      if (!aiClient.aiAvailable()) return null;
      const res = await Promise.race([
        aiClient.analyzeExternalApp({
          count,
          windowSeconds,
          threshold,
          appProfile: appProfile ? String(appProfile).slice(0, 1500) : undefined,
          recentJoins: recentJoins ?? undefined,
          memberCount: guild.memberCount ?? undefined,
        }),
        new Promise((r) => setTimeout(() => r(null), 6000)),
      ]);
      if (!res || res.offline) return null;
      return res;
    } catch (err) {
      console.error("[ai:analyzeExternalApp]", err.message);
      return null;
    }
  }

  /** Nhãn nguồn phát hiện raid: AI xác nhận hay tín hiệu deterministic (AI offline). */
  function raidNote(ai, isRaid) {
    if (!isRaid) return "";
    return ai && ai.offline !== true
      ? ` — AI xác nhận RAID (${ai?.reason || "phối hợp"})`
      : " — phát hiện RAID (nghi vấn cao)";
  }

  /**
   * Hồ sơ cụm tài khoản raid → dữ liệu huấn luyện (số acc, tuổi acc trung bình,
   * số avatar trùng nhau, thời gian vào rải rác).
   */
  function clusterStats(cluster) {
    if (!cluster || cluster.length === 0) return {};
    const now = Date.now();
    const ages = cluster.filter((m) => m.createdAt).map((m) => (now - m.createdAt) / 86_400_000);
    const avatarCounts = new Map();
    for (const m of cluster) {
      if (!m.avatar) continue;
      avatarCounts.set(m.avatar, (avatarCounts.get(m.avatar) ?? 0) + 1);
    }
    const shared = [...avatarCounts.values()].filter((c) => c >= 2).length;
    const sortedTs = cluster.map((m) => m.joinedAt || now).sort((a, b) => a - b);
    const burst = sortedTs.length > 1 ? (sortedTs[sortedTs.length - 1] - sortedTs[0]) / 1000 : 0;
    return {
      clusterMemberCount: cluster.length,
      clusterAvgAccountAgeDays: ages.length ? Math.round(ages.reduce((a, b) => a + b, 0) / ages.length) : undefined,
      clusterSharedAvatarCount: shared,
      clusterJoinBurstSeconds: Math.round(burst),
    };
  }

  /**
   * Raid Intel — săn lùng NGUỒN CƠN raid rồi ban nghi phạm.
   *
   * cluster: [{ id, username, avatar, createdAt, joinedAt }] — cụm tài khoản trong vụ.
   * extraExecutors: [User] — kẻ thực hiện hành vi phá hoại (audit log) gần đây.
   *
   * Điểm nghi vấn deterministic (chạy được cả khi AI offline):
   *   +5  kẻ thực hiện hành vi phá hoại (audit log) / tạo invite
   *   +3  avatar trùng với >= 1 acc khác trong cụm (cùng bộ tài nguyên)
   *   +2  acc mới < 7 ngày (sockpuppet) HOẶC acc cũ >= 180 ngày (nghi chủ acc chính)
   *   +1  username dạng máy (chữ + đuôi số) / vào cùng nhịp 3 giây
   * AI phân tích thêm (best-effort): nếu AI khẳng định "coordinated", điểm tăng.
   * Nghi phạm điểm >= 4 → ban (theo raidHuntBanSuspects) với lý do Raid Intel.
   */
  async function huntRaidSource(guild, config, cluster = [], extraExecutors = []) {
    // Lưu ý: KHÔNG trả null — mọi call site truyền kết quả thẳng vào
    // botRecordRaidSample (validator Convex từ chối null). Trả object đầy đủ với
    // banned=false, các field optional bỏ trống (undefined).
    if (!guild) return { reason: "không có dữ liệu", banned: false, confidence: 0 };
    if (config?.raidHuntEnabled === false) {
      return { reason: "săn nguồn cơn đã tắt", banned: false, confidence: 0 };
    }
    const hasData = (cluster && cluster.length > 0) || (extraExecutors && extraExecutors.length > 0);
    if (!hasData) return { reason: "chưa đủ tín hiệu", banned: false, confidence: 0 };

    const now = Date.now();
    const avatarGroups = new Map();
    for (const m of cluster) {
      if (!m?.avatar) continue;
      avatarGroups.set(m.avatar, (avatarGroups.get(m.avatar) ?? 0) + 1);
    }
    const burstGroups = new Map();
    for (const m of cluster) {
      const key = Math.round((m.joinedAt || now) / 3000);
      burstGroups.set(key, (burstGroups.get(key) ?? 0) + 1);
    }

    const scored = [];
    const push = (id, username, score, parts) => {
      if (!id) return;
      const existing = scored.find((s) => s.id === id);
      if (existing) existing.score += score;
      else scored.push({ id, username: username || id, score, parts: [...parts] });
    };

    for (const m of cluster) {
      if (!m?.id) continue;
      let score = 0;
      const parts = [];
      const ageDays = m.createdAt ? (now - m.createdAt) / 86_400_000 : NaN;
      if (m.avatar && (avatarGroups.get(m.avatar) ?? 0) >= 2) {
        score += 3;
        parts.push("avatar trùng nhau");
      }
      if (Number.isFinite(ageDays)) {
        if (ageDays < 7) {
          score += 2;
          parts.push("acc mới <7 ngày");
        } else if (ageDays >= 180) {
          score += 2;
          parts.push("acc cũ (nghi chủ acc chính)");
        }
      }
      if (/^[A-Za-z][A-Za-z0-9_]*\d{3,}$/.test(m.username || "")) {
        score += 1;
        parts.push("username dạng máy");
      }
      if ((burstGroups.get(Math.round((m.joinedAt || now) / 3000)) ?? 0) >= 2) {
        score += 1;
        parts.push("vào cùng nhịp");
      }
      push(m.id, m.username, score, parts);
    }

    // Kẻ thực hiện hành vi phá hoại / tạo invite gần đây (audit log) — tín hiệu mạnh nhất.
    const auditExecutors = [];
    try {
      const entries = await guild.fetchAuditLogs({ limit: 25 });
      const relevant = [
        AuditLogEvent.InviteCreate,
        AuditLogEvent.MemberBanAdd,
        AuditLogEvent.MemberKick,
        AuditLogEvent.ChannelDelete,
        AuditLogEvent.ChannelCreate,
        AuditLogEvent.RoleDelete,
        AuditLogEvent.RoleCreate,
        AuditLogEvent.WebhookCreate,
        AuditLogEvent.ThreadDelete,
      ];
      for (const e of entries.entries.values()) {
        if (!e.executor || e.executor.id === client.user.id) continue;
        if (!relevant.includes(e.action)) continue;
        if (now - e.createdTimestamp > 30 * 60_000) continue; // chỉ 30 phút gần nhất
        auditExecutors.push(e.executor);
      }
    } catch {
      // không đọc được audit log — bỏ qua
    }
    for (const ex of [...auditExecutors, ...extraExecutors]) {
      push(ex.id, ex.username, 5, ["thực hiện hành vi phá hoại (audit log)"]);
    }

    scored.sort((a, b) => b.score - a.score);
    const suspects = scored.filter((s) => s.score >= 4).slice(0, 4);
    if (suspects.length === 0) {
      // Lưu ý: dùng undefined (không dùng null) — validator Convex v.optional() chỉ chấp nhận thiếu/undefined.
      return { reason: "chưa đủ tín hiệu", banned: false, confidence: 0 };
    }

    // AI phân tích (best-effort): xác nhận phối hợp → tăng điểm nghi phạm hàng đầu.
    let aiBoost = 0;
    const ai = await aiAnalyzeRaid(
      guild,
      "source-hunt",
      cluster.length || 1,
      config?.modules?.find((m) => m.module === "massJoin")?.windowSeconds ?? 10,
      1,
      cluster
        .slice(0, 12)
        .map((m, i) => `${i + 1}. ${m.username || "?"} (acc ${m.createdAt ? Math.round((now - m.createdAt) / 86_400_000) : "?"} ngày, avatar ${m.avatar ? "có" : "không"})`)
        .join("\n"),
      auditExecutors.length
        ? `Người thực hiện phá hoại gần đây: ${auditExecutors.map((e) => e.username).join(", ")}`
        : undefined,
    );
    if (ai?.coordinated) {
      aiBoost = 2;
      scored.sort((a, b) => b.score - a.score);
    }

    // AI PHỦ QUYẾT: AI phân tích dữ liệu cụm và kết luận KHÔNG phối hợp (tin cậy đủ)
    // → chỉ ghi nhận nghi phạm, KHÔNG ban ai. Trước đây ý kiến AI bị bỏ qua khiến
    // người dùng thường (avatar trùng + acc mới) vẫn bị ban oan.
    if (ai && ai.offline !== true && ai.coordinated === false && (ai.confidence ?? 0) >= 0.5) {
      const reportTop = suspects[0];
      const reportConfidence = Math.min(0.97, 0.5 + reportTop.score / 12);
      return {
        suspectedSourceId: reportTop.id ?? undefined,
        suspectedSourceName: reportTop.username ?? undefined,
        reason: `AI đánh giá KHÔNG phối hợp — chỉ ghi nhận, không ban (${(reportTop.parts || []).join(", ")})${ai.reasoning ? ` · AI: ${ai.reasoning}` : ""}`.slice(0, 500),
        banned: false,
        confidence: Math.round(reportConfidence * 100) / 100,
      };
    }

    const top = suspects[0];
    const confidence = Math.min(0.97, 0.5 + (top.score + aiBoost) / 12);
    const bannedNames = [];
    if (config?.raidHuntBanSuspects !== false) {
      for (const s of suspects) {
        try {
          const member = await guild.members.fetch(s.id).catch(() => null);
          if (member && isExempt(member, {}, config)) continue;
          await guild.members.ban(s.id, {
            reason: `🚨 Protogon Raid Intel: nghi ngờ nguồn cơn raid (${(s.parts || []).join(", ")})`,
          });
          bannedNames.push(s.username || s.id);
        } catch {
          // thiếu quyền hoặc không fetch được — bỏ qua
        }
      }
    }
    return {
      suspectedSourceId: top.id ?? undefined,
      suspectedSourceName: top.username ?? undefined,
      reason: `điểm ${top.score} (${(top.parts || []).join(", ")})${ai?.reasoning ? ` · AI: ${ai.reasoning}` : ""}${bannedNames.length ? ` · đã ban: ${bannedNames.join(", ")}` : ""}`.slice(0, 500),
      banned: bannedNames.length > 0,
      confidence: Math.round(confidence * 100) / 100,
    };
  }

  /** Ghi mẫu dữ liệu huấn luyện raid/nuke lên Convex (fire-and-forget). */
  async function recordRaidSample(guild, config, payload) {
    try {
      await store.client.mutation("bot_writes:botRecordRaidSample", {
        guildId: guild.id,
        guildName: guild.name,
        ...payload,
      });
    } catch (err) {
      console.error("[antinuke:sample]", err.message);
    }
  }

  /**
   * Phạt một thành viên theo danh sách hành động kết hợp của module (multi-select):
   * dùng hình phạt thành viên MẠNH NHẤT (ban > kick > timeout > warn); nếu không
   * chọn hình phạt nào thì chỉ dọn tin nhắn (delete/purge) mà không đụng thành viên.
   * Module nuke/raid: phạt trực tiếp (không nhiệt). Module moderation: cộng nhiệt
   * và tự tăng cấp nếu vượt ngưỡng.
   * Trả về mô tả hành động.
   */
  async function punishWithHeat(guild, member, moduleCfg, reason, opts = {}) {
    const actions = actionsOf(moduleCfg);
    const memberActions = actions.filter((a) => ["warn", "kick", "ban", "timeout"].includes(a));
    if (memberActions.length === 0) {
      return {
        action: "không phạt thành viên (chỉ dọn tin nhắn)",
        caseNumber: undefined,
        chosen: null,
        heatRes: null,
      };
    }
    const base = memberPunishOf(actions, moduleCfg.punish || "warn");
    // Nuke module: phạt trực tiếp theo cấu hình. BOT (thành viên là bot user) trigger
    // module chống nuke/raid: cũng phạt THẲNG TAY theo cấu hình — bot không cần cộng
    // nhiệt như người dùng (không "học" sau nhiều lần nhắc nhở). opts.direct tương tự.
    if (NUKE_MODULES.has(moduleCfg.module) || opts.direct || member?.user?.bot === true) {
      const chosen = base;
      const res = await punishMember(guild, member, chosen, reason, moduleCfg.timeoutSeconds, store);
      return { action: res.action, caseNumber: res.caseNumber, chosen, heatRes: null };
    }
    const s = heatSettings(configOf(guild.id));
    const heatRes = await heat.add(
      guild.id,
      member.id,
      member.user?.username,
      moduleCfg.heat ?? 10,
      s,
    );
    const chosen = choosePunish(base, heatRes);
    const res = await punishMember(guild, member, chosen, reason, moduleCfg.timeoutSeconds, store);
    if (chosen !== "warn") heat.markPunished(guild.id, member.id);
    return {
      action: res.action + heatSummary(heatRes),
      caseNumber: res.caseNumber,
      chosen,
      heatRes,
    };
  }

  // Lưu config đã đọc gần nhất để punishWithHeat tái sử dụng (tránh đọc lại DB).
  function configOf(guildId) {
    return lastConfigs.get(guildId) ?? {};
  }

  /** Auto-lock channels when a raid is confirmed and lockdown is enabled. */
  async function maybeLockdown(guild, config) {
    if (!config.lockdownEnabled) return;
    if (isLocked(guild.id)) return;
    await lockGuild(client, guild, config, store);
  }

  /**
   * Raid bằng ỨNG DỤNG NGOÀI (External App) — phát hiện loạt kết nối integration
   * (external app) trong cửa sổ thời gian. AI nhận diện xem NGƯỜI DÙNG của các
   * app đó có đang raid không: AI khẳng định raid (độ tin cậy >= 0.6) → ban + khóa
   * kênh; còn lại → phạt theo cấu hình (mặc định kick).
   */
  async function handleExternalApp(entry, guild) {
    if (!guild || guild.available === false) return;
    const config = await store.getConfig(guild.id);
    if (!config || !config.antinukeEnabled) return;
    lastConfigs.set(guild.id, config);
    const moduleCfg = moduleCfgOf(config, "externalAppRaid");
    if (!moduleCfg || !moduleCfg.enabled) return;

    const executor = entry.executor;
    let executorFresh = false;
    if (executor) {
      if (executor.id === client.user.id) return;
      const em = await guild.members.fetch(executor.id).catch(() => null);
      if (em) {
        if (isExempt(em, moduleCfg, config)) return;
        // Acc mới < 7 ngày kết nối app = sockpuppet nghi vấn cao (đội quân cài app).
        if (em.user?.createdTimestamp && Date.now() - em.user.createdTimestamp < 7 * 86_400_000) {
          executorFresh = true;
        }
      }
    }
    const target = entry.target;
    // Phân biệt BOT ĐƯỢC MỜI CHÍNH THỨC với EXTERNAL APP: bỏ qua nếu đây là
    //   - kết nối tài khoản thường (twitch/youtube) — không phải đường raid app;
    //   - app có bot user LÀ thành viên server (đã được mời chính thức, kể cả qua
    //     App Directory) — vụ này thuộc module massBotAdd, không phải external app;
    //   - bot xác minh (có tick) — bot hợp lệ của Discord.
    // External app = ứng dụng Discord được kết nối từ ngoài mà KHÔNG có bot user
    // trong server (chỉ có webhook/command) — đúng đường raid "cài app không cần mời bot".
    if (target) {
      const integrationType = target.type;
      const appId = target.application?.id || (target.type === "discord" ? target.id : null);
      let isGuildMember = false;
      let hasVerifiedTick = false;
      if (appId) {
        const m = await guild.members.fetch(appId).catch(() => null);
        isGuildMember = !!m;
        if (!isGuildMember) {
          const u = await guild.client?.users?.fetch(appId).catch(() => null);
          hasVerifiedTick = !!u && u.bot === true && u.flags?.has(UserFlags.VerifiedBot) === true;
        }
      }
      if (!isExternalAppTarget({ integrationType, isGuildMember, hasVerifiedTick })) return;
    }
    const appName =
      (target && (target.name || target.id)) ||
      (entry.changes || []).find((c) => c.key === "name")?.new ||
      "ứng dụng ngoài";

    // Điểm nghi vấn deterministic (chạy ngay cả khi AI offline): tên app đáng ngờ
    // (giả mạo app nổi tiếng / từ khóa scam) + acc kết nối mới + làn sóng thành viên.
    const appSus = appNameSuspicion(appName);
    const joins5m = recentJoinCount(guild.id, 5 * 60_000);
    let suspectScore = appSus.score + (executorFresh ? 3 : 0);
    if (joins5m >= 5) suspectScore += 2;

    const arr = appEvents.get(guild.id) ?? [];
    arr.push({
      ts: Date.now(),
      appName: String(appName).slice(0, 60),
      executorId: executor?.id,
      executorName: executor?.username,
    });
    const cutoff = Date.now() - moduleCfg.windowSeconds * 1000;
    const fresh = arr.filter((e) => e.ts >= cutoff);
    appEvents.set(guild.id, fresh);
    const count = fresh.length;
    // Xử lý khi: vượt ngưỡng kết nối HOẶC 1 kết nối đủ nghi vấn
    // (vd acc mới cài app giả mạo — biến thể raid "1 app độc cài rải rác").
    if (count < moduleCfg.threshold && suspectScore < 4) return;

    // AI nhận diện: người dùng app ngoài có đang raid không? (kèm tín hiệu deterministic)
    const profile = `${fresh
      .map(
        (e, i) =>
          `${i + 1}. ${e.appName}${e.executorName ? ` — bởi ${e.executorName}` : " — không xác định được người dùng"}`,
      )
      .join("\n")}\nTín hiệu: tên app đáng ngờ=${appSus.score} (${appSus.parts.join(", ") || "không"}), acc kết nối mới <7 ngày=${executorFresh ? "có" : "không"}, thành viên mới 5 phút gần nhất=${joins5m}, nghi vấn tổng=${suspectScore}`;
    const recentJoins = joiners.get(guild.id)?.length ?? 0;
    const ai = await aiAnalyzeExternalApp(
      guild,
      count,
      moduleCfg.windowSeconds,
      moduleCfg.threshold,
      profile,
      recentJoins,
    );
    // AI khẳng định raid (tin cậy >= 0.6) → ban + khóa. AI kết luận KHÔNG raid
    // (tin cậy >= 0.5) → CHỈ GHI NHẬN, không phạt ai — trước đây ý kiến AI bị bỏ
    // qua khiến người dùng cài app bình thường vẫn bị kick oan. AI offline → chỉ
    // xử lý khi nghi vấn rất cao (>= 6); 2 kết nối app bình thường (không có tín
    // hiệu) đủ ngưỡng thì không phạt ai.
    const aiOffline = !ai || ai.offline === true;
    const aiSaysRaid = ai?.isRaid === true && (ai?.confidence ?? 0) >= 0.6;
    const aiSaysNotRaid = ai && ai.offline !== true && ai?.isRaid === false && (ai?.confidence ?? 0) >= 0.5;
    const aiUnknown = ai && ai.offline !== true && ai?.isRaid === null;
    const isRaid = aiSaysRaid || (aiOffline && suspectScore >= 6);
    if (
      aiSaysNotRaid ||
      (aiOffline && suspectScore < 4 && count <= moduleCfg.threshold) ||
      (aiUnknown && suspectScore < 4)
    ) {
      await recordEvent(guild.id, {
        module: "externalAppRaid",
        action: aiSaysNotRaid
          ? `bỏ qua — AI: không raid (${ai?.reason ?? "không đủ tín hiệu"})`
          : "bỏ qua — kết nối app bình thường, không có tín hiệu raid",
        count,
        windowSeconds: moduleCfg.windowSeconds,
        threshold: moduleCfg.threshold,
        punish: "none",
      });
      return;
    }
    const reason = `[Protogon AntiNuke] ${MODULE_LABELS.externalAppRaid}: ${count} app được kết nối trong ${moduleCfg.windowSeconds}s (ngưỡng ${moduleCfg.threshold})${raidNote(ai, isRaid)}`;

    // Những người dùng đã kết nối app trong cửa sổ (bỏ trùng, giới hạn 5).
    const targets = [
      ...new Map(fresh.filter((e) => e.executorId).map((e) => [e.executorId, e])).values(),
    ].slice(0, 5);
    // Chống log chồng chặp: đợt kết nối app vừa được xử lý trong cùng cửa sổ → bỏ qua
    // (1 làn sóng kết nối app = 1 vụ; IntegrationCreate kế tiếp không ghi vụ mới).
    const lastProc = lastExtAppProcessedAt.get(guild.id);
    if (lastProc && Date.now() - lastProc < moduleCfg.windowSeconds * 1000) return;
    // Bỏ người dùng đã bị tầng khác (audit / tin nhắn app) xử lý trong cửa sổ → không
    // phạt + log trùng; đánh dấu NGAY để tầng còn lại không xử lý tiếp cùng người này.
    const freshTargets = targets.filter(
      (t) => !appUserHandledRecently(guild.id, t.executorId, moduleCfg.windowSeconds * 1000),
    );
    if (freshTargets.length === 0) return;
    lastExtAppProcessedAt.set(guild.id, Date.now());
    for (const t of freshTargets) markAppUserHandled(guild.id, t.executorId);

    // Danh sách app được kết nối trong cửa sổ (bỏ trùng, giới hạn 10) — hiển thị trên dashboard.
    const apps = [];
    for (const e of fresh) {
      if (apps.some((a) => a.appName.toLowerCase() === e.appName.toLowerCase())) continue;
      apps.push({
        appName: e.appName,
        executorName: e.executorName ?? undefined,
        executorId: e.executorId ?? undefined,
      });
      if (apps.length >= 10) break;
    }

    const punished = [];
    const punishedUsers = [];
    let firstPunishedUserId = null;
    let firstPunishedUsername = null;
    for (const t of freshTargets) {
      const member = await guild.members.fetch(t.executorId).catch(() => null);
      if (!member || isExempt(member, moduleCfg, config)) continue;
      let outcome;
      let actionLabel;
      if (isRaid) {
        try {
          await member.ban({ reason });
          outcome = ai && ai.offline !== true ? "🚫 đã ban (AI: raid)" : "🚫 đã ban (nghi vấn raid)";
          actionLabel = "ban";
        } catch {
          outcome = "không thể ban";
          actionLabel = "ban thất bại";
        }
      } else {
        const res = await punishWithHeat(guild, member, moduleCfg, reason);
        outcome = res.action;
        actionLabel = res.chosen ?? "xử lý";
      }
      if (!firstPunishedUserId) {
        firstPunishedUserId = t.executorId;
        firstPunishedUsername = t.executorName;
      }
      punished.push(`<@${t.executorId}>: ${outcome}`);
      punishedUsers.push({
        userId: t.executorId,
        username: t.executorName ?? undefined,
        action: String(actionLabel).slice(0, 40),
      });
    }
    const action =
      punished.length > 0 ? punished.slice(0, 6).join("\n") : "chưa xác định được người dùng — chỉ ghi nhận";
    if (isRaid) await maybeLockdown(guild, config);

    await recordEvent(guild.id, {
      module: "externalAppRaid",
      executorId: freshTargets[0]?.executorId ?? targets[0]?.executorId ?? undefined,
      executorName: freshTargets[0]?.executorName ?? targets[0]?.executorName ?? undefined,
      action: `${action}${isRaid ? " (raid)" : ""}`,
      count,
      windowSeconds: moduleCfg.windowSeconds,
      threshold: moduleCfg.threshold,
      punish: isRaid ? "ban" : moduleCfg.punish,
    });

    // Raid Intel: mẫu huấn luyện kèm AI verdict + săn nguồn cơn.
    try {
      const sourceHunt = await huntRaidSource(
        guild,
        config,
        [],
        // Chỉ săn nguồn cơn khi AI xác nhận raid — tránh ban nhầm người dùng
        // kết nối app bình thường khi AI kết luận "individual".
        isRaid
          ? freshTargets.filter((t) => t.executorId).map((t) => ({ id: t.executorId, username: t.executorName }))
          : [],
      );
      await recordRaidSample(guild, config, {
        module: "externalAppRaid",
        count,
        windowSeconds: moduleCfg.windowSeconds,
        threshold: moduleCfg.threshold,
        action,
        punish: isRaid ? "ban" : moduleCfg.punish,
        aiClassification: ai ? (isRaid ? "raid" : "individual") : undefined,
        aiConfidence: ai?.confidence,
        aiReason: ai?.reason,
        lockdownTriggered: isLocked(guild.id),
        sourceHunt,
        apps,
        punished: punishedUsers,
      });
    } catch (e) {
      console.error("[antinuke:externalAppRaid:sample]", e.message);
    }

    const embed = logEmbed({
      title: `🚨 Anti Nuke/Raid: ${MODULE_LABELS.externalAppRaid}`,
      description: `**${count}** ứng dụng ngoài được kết nối trong **${moduleCfg.windowSeconds} giây** (ngưỡng ${moduleCfg.threshold}).${raidNote(ai, isRaid)}`,
      color: Colors.Red,
      fields: [
        {
          name: "Kết quả xử lý",
          value: action.slice(0, 1000),
          inline: true,
        },
        { name: "Ứng dụng", value: profile.slice(0, 1000), inline: true },
        { name: "Nguồn", value: "🛡️ Bot tự động phát hiện (anti nuke/raid)", inline: true },
        { name: "Module", value: "`externalAppRaid`", inline: true },
      ],
      footer: "Protogon · Anti Nuke/Raid",
    });
    await sendLog(guild, config, embed, "raid");

    // BÁO CÁO KHẨN: AI quét chat + tổng hợp tình hình → cảnh báo mọi người
    // (tối đa 1 lần / 5 phút / server, fire-and-forget).
    emergencyRaidAlert(client, store, guild, {
      summary: `External app raid — ${count} app trong ${moduleCfg.windowSeconds}s`,
      reason: reason,
      lockdownActive: isLocked(guild.id),
    }).catch(() => {});

    // Gửi embed case log kiểu Carl-bot tới kênh log moderation (dùng đúng biến local)
    if (firstPunishedUserId) {
      try {
        const caseAction = isRaid ? 'ban' : (moduleCfg.punish || 'kick');
        const caseRec = await store.client.mutation('bot_writes:botRecordModAction', {
          guildId: guild.id,
          action: (CASE_LABEL[caseAction] || caseAction).replace(/[^\p{L}\p{N}\s]/gu, '').trim().slice(0, 20) || caseAction,
          targetId: firstPunishedUserId,
          targetName: firstPunishedUsername,
          reason: '[AntiNuke] ' + MODULE_LABELS.externalAppRaid + ': ' + count + ' app/' + moduleCfg.windowSeconds + 's',
        }).catch(() => null);
        await sendCaseLog({
          guild,
          guildConfig: config,
          action: caseAction,
          caseNumber: caseRec?.caseNumber,
          offender: { id: firstPunishedUserId, username: firstPunishedUsername || firstPunishedUserId },
          reason: '[AntiNuke] ' + MODULE_LABELS.externalAppRaid + ': ' + count + ' app trong ' + moduleCfg.windowSeconds + 's' + (punished.length > 1 ? ' (+' + (punished.length - 1) + ' người khác)' : ''),
          executor: null,
        });
      } catch (e) {
        console.error('[antinuke:externalAppRaid:caseLog]', e.message);
      }
    }
  }

  /**
   * External App Guard (tầng tin nhắn) — bắt SPAM do chính ứng dụng ngoài gửi vào
   * server (bot lạ / app qua webhook), không cần chờ audit log IntegrationCreate.
   * Phát hiện theo 3 tín hiệu: nội dung lặp giống hệt (kể cả chỉ gửi embed), số tin
   * vượt ngưỡng KÈM link mời Discord, hoặc app gửi quá nhiều tin trong cửa sổ (flood).
   * Xử lý: xóa tin + phạt bot user theo cấu hình / xóa webhook + truy tìm người tạo
   * webhook (audit log) để phạt đúng người dùng đang raid + AI nhận diện raid (ban + lockdown).
   */
  async function handleExternalAppMessage(message) {
    if (!message.guild || message.guild.available === false) return;
    if (message.channel.isDMBased?.()) return;
    const me = client.user?.id;
    if (!me || message.author?.id === me) return;
    // Chỉ xử lý tin đến từ ỨNG DỤNG ngoài: bot khác / webhook. Lệnh app do người
    // dùng bấm có author là người thật → bỏ qua (module spam dành cho người dùng lo).
    const isBot = message.author?.bot === true;
    const isWebhook = !!message.webhookId;
    if (!isBot && !isWebhook) return;
    // BOT USER = bot đã được mời vào server (phải là thành viên mới gửi được tin, kể cả
    // bot có tick xác minh, slash-command response, bot nhạc/leveling...). External app
    // KHÔNG phải thành viên — nó gửi tin qua WEBHOOK. Bỏ qua bot user để không phạt nhầm
    // bot quen thuộc; tầng audit (IntegrationCreate) đã xử lý app kết nối ngoài.
    if (!isExternalAppTarget({ isBot, isWebhook })) return;

    // Whitelist known logging bots (Carl-bot, MEE6, Dyno...) — tạo webhook hợp pháp
    // để ghi log, KHÔNG phải external app raid.
    const webhookName = (message.author?.username || '').toLowerCase();
    if (webhookName && KNOWN_LOGGING_BOTS.some(b => webhookName.includes(b))) return;

    const config = await store.getConfig(message.guild.id);
    if (!config || !config.antinukeEnabled) return;
    lastConfigs.set(message.guild.id, config);
    const moduleCfg = moduleCfgOf(config, "externalAppRaid");
    if (!moduleCfg || !moduleCfg.enabled) return;

    // Định danh app: ưu tiên applicationId (app) > webhookId (webhook) > bot user id.
    const appId = message.applicationId || message.webhookId || message.author.id;
    if ((config?.whitelistUsers || []).includes(appId)) return;
    if ((config?.whitelistUsers || []).includes(message.author.id)) return;
    const appName =
      message.author?.username ||
      (message.webhookId ? "webhook" : null) ||
      appId;

    const now = Date.now();
    const key = `${message.guild.id}:${appId}`;
    const arr = appMsgSamples.get(key) ?? [];
    const fp = messageFingerprint(message);
    arr.push({
      fp,
      norm: normalizeFuzzy(fp),
      content: message.content || "",
      ts: now,
      id: message.id,
      channelId: message.channel.id,
    });
    const cutoff = now - moduleCfg.windowSeconds * 1000;
    const fresh = arr.filter((e) => e.ts >= cutoff);
    appMsgSamples.set(key, fresh);
    const count = fresh.length;

    const hay = `${message.content || ""} ${(message.embeds || []).map((e) => e.title || e.description || "").join(" ")} ${componentText(message)}`;
    const { triggered, sameFingerprint, similar, hasInvite, hasShortlink, hasEveryone, scamHits, urlCount } =
      isExternalAppSpam({
        samples: fresh,
        currentFingerprint: fp,
        count: fresh.length,
        threshold: moduleCfg.threshold,
        hay,
      });
    if (!triggered) return;

    appMsgSamples.delete(key); // reset sau khi xử lý
    const samples = fresh.slice(-8).map((e) => (e.fp || e.content || "").slice(0, 200));
    // Đưa cả tín hiệu nội dung cho AI học hỏi: lặp gần giống, @everyone, link mời,
    // link rút gọn, từ khóa scam, số URL — để AI nhận diện đúng biến thể raid app.
    const hasButtons = (message.components || []).some((row) => (row.components || []).length > 0);
    const signalLine =
      `Tín hiệu nội dung: lặp giống hệt=${sameFingerprint}, lặp gần giống=${similar}, ` +
      `@everyone/@here=${hasEveryone ? "có" : "không"}, link mời Discord=${hasInvite ? "có" : "không"}, ` +
      `link rút gọn=${hasShortlink ? "có" : "không"}, từ khóa scam=${scamHits}, số URL=${urlCount}, ` +
      `nút bấm/menu=${hasButtons ? "có" : "không"}`;
    const profile =
      `${appName}${isWebhook ? " (webhook)" : " (bot)"}:\n${samples.map((s, i) => `${i + 1}. ${s}`).join("\n")}\n${signalLine}`;
    const ai = await aiAnalyzeExternalApp(
      message.guild,
      count,
      moduleCfg.windowSeconds,
      moduleCfg.threshold,
      profile,
      joiners.get(message.guild.id)?.length ?? 0,
    );
    // AI khẳng định raid (confidence >= 0.6) HOẶC AI offline mà tín hiệu nội dung quá rõ → raid.
    const aiOffline = !ai || ai.offline === true;
    let contentScore = 0;
    if (similar >= 2) contentScore += 3;
    if (hasEveryone) contentScore += 2;
    if (scamHits >= 2) contentScore += 2;
    if (hasInvite || hasShortlink) contentScore += 2;
    if (urlCount >= 3) contentScore += 1;
    // Tin app đăng kèm NÚT BẤM = "mồi" raid (lừa bấm) — tăng nghi vấn.
    if (hasButtons) contentScore += 2;
    const isRaid =
      (ai?.isRaid === true && (ai?.confidence ?? 0) >= 0.6) || (aiOffline && contentScore >= 6);
    const reason = `[Protogon AntiNuke] ${MODULE_LABELS.externalAppRaid}: app "${appName}" gửi ${count} tin (${sameFingerprint} tin lặp nội dung) trong ${moduleCfg.windowSeconds}s (ngưỡng ${moduleCfg.threshold})${raidNote(ai, isRaid)}`;

    let action = "đã ghi nhận";
    const punished = [];
    const punishedUsers = [];
    const apps = [{ appName: String(appName).slice(0, 60), executorName: undefined, executorId: appId }];

    // 1) Dọn tin nhắn của app trong kênh này (xóa tin phát hiện + purge theo author).
    const cleanup = await cleanupMessages({
      guild: message.guild,
      channel: message.channel,
      userId: message.author.id,
      actions: ["deleteMessages", "purgeMessages"],
      triggerMessage: message,
    });
    if (cleanup) action = cleanup;

    let responsibleId;
    let responsibleName;
    // Chống log chồng chặp: người dùng app vừa bị tầng audit (IntegrationCreate) xử lý trong
    // cửa sổ → tầng tin nhắn chỉ dọn tin/webhook, không phạt + ghi sự kiện/embed trùng.
    const userHandledWindow = moduleCfg.windowSeconds * 1000;
    // 2) Nếu app là BOT user trong server → phạt theo cấu hình (kick mặc định; AI raid → ban).
    const member = isBot ? await message.guild.members.fetch(message.author.id).catch(() => null) : null;
    const memberAlreadyHandled = appUserHandledRecently(
      message.guild.id,
      member?.id,
      userHandledWindow,
    );
    if (member && !isExempt(member, moduleCfg, config) && !memberAlreadyHandled) {
      markAppUserHandled(message.guild.id, member.id);
      let outcome;
      let actionLabel;
      if (isRaid) {
        try {
          await member.ban({ reason });
          outcome = ai && ai.offline !== true ? "🚫 đã ban (AI: raid)" : "🚫 đã ban (nghi vấn raid)";
          actionLabel = "ban";
        } catch {
          outcome = "không thể ban";
          actionLabel = "ban thất bại";
        }
      } else {
        const res = await punishWithHeat(message.guild, member, moduleCfg, reason);
        outcome = res.action;
        actionLabel = res.chosen ?? "xử lý";
      }
      punished.push(`<@${member.id}>: ${outcome}`);
      punishedUsers.push({
        userId: member.id,
        username: member.user?.username ?? undefined,
        action: String(actionLabel).slice(0, 40),
      });
      action = punished.join("\n");
    } else if (isWebhook) {
      // 3) App chỉ qua webhook (không có bot user) → xóa webhook để chặn app, rồi
      //    truy tìm người tạo webhook (audit log) để phạt đúng người dùng đang raid.
      try {
        const wh = await message.channel.fetchWebhooks();
        const target = wh.find((w) => w.id === message.webhookId);
        if (target) {
          await target.delete(reason);
          action = `${action} · đã xóa webhook của app`;
        }
        const creator = await webhookCreator(message.guild, message.webhookId);
        if (creator && creator.id !== me) {
          responsibleId = creator.id;
          responsibleName = creator.username;
          const cm = await message.guild.members.fetch(creator.id).catch(() => null);
          if (
            cm &&
            !isExempt(cm, moduleCfg, config) &&
            !appUserHandledRecently(message.guild.id, cm.id, userHandledWindow)
          ) {
            markAppUserHandled(message.guild.id, cm.id);
            let outcome;
            let actionLabel;
            if (isRaid) {
              try {
                await cm.ban({ reason });
                outcome = ai && ai.offline !== true
                  ? "🚫 đã ban người dùng kết nối app (AI: raid)"
                  : "🚫 đã ban người dùng kết nối app (nghi vấn raid)";
                actionLabel = "ban";
              } catch {
                outcome = "không thể ban người dùng kết nối app";
                actionLabel = "ban thất bại";
              }
            } else {
              const res = await punishWithHeat(message.guild, cm, moduleCfg, reason);
              outcome = res.action;
              actionLabel = res.chosen ?? "xử lý";
            }
            punished.push(`<@${cm.id}> (người dùng app): ${outcome}`);
            punishedUsers.push({
              userId: cm.id,
              username: cm.user?.username ?? undefined,
              action: String(actionLabel).slice(0, 40),
            });
            action = punished.join("\n");
          }
        }
      } catch {
        // thiếu quyền Manage Webhooks — bỏ qua
      }
    }
    if (isRaid) await maybeLockdown(message.guild, config);

    // Người dùng app đã bị tầng kia xử lý trong cửa sổ → tầng này chỉ dọn tin/webhook,
    // không ghi sự kiện + embed trùng (vụ đã được log ở tầng trước).
    const alreadyHandled =
      (member && appUserHandledRecently(message.guild.id, member.id, userHandledWindow)) ||
      (responsibleId && appUserHandledRecently(message.guild.id, responsibleId, userHandledWindow));
    if (punished.length === 0 && alreadyHandled) return;

    await recordEvent(message.guild.id, {
      module: "externalAppRaid",
      executorId: responsibleId ?? appId,
      executorName: responsibleName ?? appName,
      action: `${action}${isRaid ? " (raid)" : ""}`.slice(0, 900),
      count,
      windowSeconds: moduleCfg.windowSeconds,
      threshold: moduleCfg.threshold,
      punish: isRaid ? "ban" : moduleCfg.punish,
    });

    // Raid Intel: mẫu huấn luyện kèm AI verdict + săn nguồn cơn.
    try {
      const sourceHunt = await huntRaidSource(
        message.guild,
        config,
        [],
        // Chỉ săn nguồn cơn khi AI xác nhận raid — tránh ban nhầm người dùng
        // app bình thường khi AI kết luận "individual".
        isRaid && responsibleId
          ? [{ id: responsibleId, username: responsibleName }]
          : isRaid && isBot && member
            ? [{ id: member.id, username: member.user?.username }]
            : [],
      );
      await recordRaidSample(message.guild, config, {
        module: "externalAppRaid",
        count,
        windowSeconds: moduleCfg.windowSeconds,
        threshold: moduleCfg.threshold,
        action,
        punish: isRaid ? "ban" : moduleCfg.punish,
        aiClassification: ai ? (isRaid ? "raid" : "individual") : undefined,
        aiConfidence: ai?.confidence,
        aiReason: ai?.reason,
        lockdownTriggered: isLocked(message.guild.id),
        sourceHunt,
        apps,
        punished: punishedUsers,
      });
    } catch (e) {
      console.error("[antinuke:externalAppRaid:msg:sample]", e.message);
    }

    const embed = logEmbed({
      title: `🚨 Anti Nuke/Raid: ${MODULE_LABELS.externalAppRaid}`,
      description: `Ứng dụng ngoài **${appName}** gửi **${count} tin** (${sameFingerprint} tin lặp nội dung) trong **${moduleCfg.windowSeconds} giây** (ngưỡng ${moduleCfg.threshold}).${raidNote(ai, isRaid)}`,
      color: Colors.Red,
      fields: [
        {
          name: "Kết quả xử lý",
          value: (action || "đã ghi nhận").slice(0, 1000),
          inline: true,
        },
        { name: "Ứng dụng", value: `${appName} (\`${appId}\`)`, inline: true },
        { name: "Kênh", value: `<#${message.channel.id}>`, inline: true },
        { name: "Nguồn", value: "🛡️ Bot tự động phát hiện (anti nuke/raid)", inline: true },
        { name: "Module", value: "`externalAppRaid`", inline: true },
      ],
      footer: "Protogon · Anti Nuke/Raid",
    });
    await sendLog(message.guild, config, embed, "raid");
  }

  /**
   * Chống raid bằng NÚT BẤM (button spam) của app ngoài: app được kết nối từ ngoài
   * (gửi tin qua WEBHOOK, không cần mời bot vào server) đăng tin có nút bấm làm
   * "mồi"; kẻ raid spam bấm nút để kích hoạt hành động của app (spam tin, gán role,
   * mời, DM...), hoặc một làn sóng người bấm cùng 1 tin app trong cửa sổ. Phát hiện:
   *   - spamClicker: CÙNG 1 người bấm >= 4 lần trong cửa sổ → phạt kẻ spam bấm;
   *   - clickFlood: tổng lượt bấm >= ngưỡng trong cửa sổ → xóa tin mồi + khóa kênh.
   * Mọi trường hợp đều xóa tin mồi chứa nút bấm + ghi sự kiện externalAppRaid.
   */
  async function handleButtonRaid(interaction) {
    if (!interaction.isMessageComponent?.()) return;
    if (!interaction.inGuild?.() || !interaction.guild || interaction.guild.available === false) return;
    const msg = interaction.message;
    if (!msg || !msg.components || msg.components.length === 0) return;
    // Chỉ quan tâm tin của APP NGOÀI thực sự: tin qua WEBHOOK (app kết nối từ ngoài,
    // KHÔNG có bot user là thành viên — đúng đường raid "cài app không cần mời bot").
    // Nút bấm của BOT đã được mời vào server (role picker, mini-game...) là hợp lệ,
    // không soi — tránh phạt nhầm như fix phân biệt bot mời chính thức trước đó.
    if (!msg.webhookId) return;

    const config = await store.getConfig(interaction.guild.id);
    if (!config || !config.antinukeEnabled) return;
    lastConfigs.set(interaction.guild.id, config);
    const moduleCfg = moduleCfgOf(config, "externalAppRaid");
    if (!moduleCfg || !moduleCfg.enabled) return;

    const appId = msg.webhookId;
    if ((config?.whitelistUsers || []).includes(appId)) return;

    const now = Date.now();
    const key = `${interaction.guild.id}:${msg.id}`;
    const bucket = buttonClickEvents.get(key) ?? {
      appId,
      channelId: msg.channel?.id,
      clicks: [],
    };
    bucket.clicks.push({ userId: interaction.user.id, ts: now });
    const cutoff = now - moduleCfg.windowSeconds * 1000;
    const fresh = bucket.clicks.filter((c) => c.ts >= cutoff);
    bucket.clicks = fresh;
    buttonClickEvents.set(key, bucket);

    const totalClicks = fresh.length;
    const sameUserClicks = fresh.filter((c) => c.userId === interaction.user.id).length;
    const signal = buttonRaidSignal({ totalClicks, sameUserClicks, threshold: moduleCfg.threshold });
    if (!signal.triggered) return;
    buttonClickEvents.delete(key); // reset sau khi xử lý

    // Debounce: vụ bấm nút trên tin này đã được xử lý trong cửa sổ → bỏ qua hẳn
    // (minigame đông người sẽ kích hoạt lại bucket liên tục — tránh gọi AI + ghi
    // event lặp mỗi lượt bấm).
    const lastBtnHandled = buttonRaidHandledAt.get(key);
    if (lastBtnHandled && Date.now() - lastBtnHandled < moduleCfg.windowSeconds * 1000) return;
    buttonRaidHandledAt.set(key, Date.now());

    const appName = msg.author?.username || (msg.webhookId ? "webhook" : null) || appId;

    // CHỐNG KHÓA KÊNH NGẤY: làn sóng bấm nút còn phải qua AI. Minigame/giveaway
    // thật (nhiều user bấm nút vui) là hiện tượng bình thường — chỉ xử lý khi AI
    // xác nhận đây là mồi raid (tin cậy >= 0.6). AI offline/không rõ → chỉ xử lý
    // kẻ spam bấm lặp lại (>= 4 lượt cùng 1 người), KHÔNG khóa kênh chỉ vì đông người bấm.
    const clickProfile = `App "${appName}" (webhook ${appId}) — tin có nút bấm được ${totalClicks} lượt bấm trong ${moduleCfg.windowSeconds}s (${sameUserClicks} lượt cùng 1 người, ${new Set(fresh.map((c) => c.userId)).size} người khác nhau).`;
    const clickAi = await aiAnalyzeExternalApp(
      interaction.guild,
      totalClicks,
      moduleCfg.windowSeconds,
      moduleCfg.threshold,
      clickProfile,
      joiners.get(interaction.guild.id)?.length ?? 0,
    );
    const clickAiRaid =
      clickAi?.isRaid === true && (clickAi?.confidence ?? 0) >= 0.6;
    const clickAiNotRaid =
      clickAi && clickAi.offline !== true && clickAi.isRaid === false && (clickAi?.confidence ?? 0) >= 0.5;
    if (clickAiNotRaid || (clickAiRaid === false && !clickAiNotRaid && !signal.spamClicker)) {
      // AI không xác nhận raid → chỉ ghi nhận, không phạt, không khóa kênh.
      await recordEvent(interaction.guild.id, {
        module: "externalAppRaid",
        action: `bỏ qua — bấm nút bình thường (${totalClicks} lượt trên tin app)${clickAi?.reason ? ` · AI: ${clickAi.reason}` : ""}`,
        count: totalClicks,
        windowSeconds: moduleCfg.windowSeconds,
        threshold: moduleCfg.threshold,
        punish: "none",
      });
      return;
    }

    const reason = `[Protogon AntiNuke] ${MODULE_LABELS.externalAppRaid}: nút bấm spam trên tin app "${appName}" (${totalClicks} lượt bấm trong ${moduleCfg.windowSeconds}s, ${sameUserClicks} lượt cùng người)${raidNote(clickAi, clickAiRaid)}`;

    let action = "đã ghi nhận";
    // 1) Xóa tin mồi chứa nút bấm — chặn làn sóng bấm tiếp.
    if (msg.deletable) {
      try {
        await msg.delete(reason);
        action = "đã xóa tin mồi (nút bấm)";
      } catch {
        action = "không xóa được tin mồi";
      }
    }

    const punished = [];
    const punishedUsers = [];
    // 2) Kẻ spam bấm (cùng 1 người bấm liên tục) → phạt theo cấu hình (kick mặc định).
    if (signal.spamClicker) {
      const clicker = await interaction.guild.members.fetch(interaction.user.id).catch(() => null);
      if (
        clicker &&
        !isExempt(clicker, moduleCfg, config) &&
        !appUserHandledRecently(interaction.guild.id, clicker.id, moduleCfg.windowSeconds * 1000)
      ) {
        markAppUserHandled(interaction.guild.id, clicker.id);
        const res = await punishWithHeat(interaction.guild, clicker, moduleCfg, reason);
        punished.push(`<@${clicker.id}> (spam bấm nút): ${res.action}`);
        punishedUsers.push({
          userId: clicker.id,
          username: clicker.user?.username ?? undefined,
          action: String(res.chosen ?? "xử lý").slice(0, 40),
        });
        action = punished.join("\n");
      }
    }
    // 3) Làn sóng bấm (nhiều người bấm cùng 1 tin app) → khóa kênh CHỈ khi AI
    //    xác nhận raid (tránh khóa kênh oan minigame/giveaway khi AI offline).
    if (signal.clickFlood && clickAiRaid) {
      await maybeLockdown(interaction.guild, config);
      action = `${action} · làn sóng bấm nút (${totalClicks} lượt)`;
    }
    if (punished.length === 0 && !signal.clickFlood) return;

    await recordEvent(interaction.guild.id, {
      module: "externalAppRaid",
      executorId: signal.spamClicker ? interaction.user.id : undefined,
      executorName: signal.spamClicker ? interaction.user.username : undefined,
      action: action.slice(0, 900),
      count: totalClicks,
      windowSeconds: moduleCfg.windowSeconds,
      threshold: moduleCfg.threshold,
      punish: signal.spamClicker ? moduleCfg.punish : "none",
    });

    // Raid Intel: ghi mẫu huấn luyện (raider = người spam bấm, nếu xác định được).
    try {
      await recordRaidSample(interaction.guild, config, {
        module: "externalAppRaid",
        count: totalClicks,
        windowSeconds: moduleCfg.windowSeconds,
        threshold: moduleCfg.threshold,
        action,
        punish: signal.spamClicker ? moduleCfg.punish : "none",
        aiClassification: clickAiRaid ? "raid" : undefined,
        lockdownTriggered: isLocked(interaction.guild.id),
        apps: [{ appName: String(appName).slice(0, 60), executorName: undefined, executorId: appId }],
        punished: punishedUsers,
      });
    } catch (e) {
      console.error("[antinuke:externalAppRaid:btn:sample]", e.message);
    }

    const embed = logEmbed({
      title: `🚨 Anti Nuke/Raid: ${MODULE_LABELS.externalAppRaid}`,
      description: `Phát hiện **nút bấm spam** trên tin của ứng dụng ngoài **${appName}**: **${totalClicks} lượt bấm** (${sameUserClicks} lượt cùng người) trong **${moduleCfg.windowSeconds} giây**.`,
      color: Colors.Red,
      fields: [
        {
          name: "Kết quả xử lý",
          value: action.slice(0, 1000),
          inline: true,
        },
        { name: "Ứng dụng", value: `${appName} (\`${appId}\`)`, inline: true },
        { name: "Kênh", value: `<#${msg.channel?.id ?? "?"}>`, inline: true },
        { name: "Nguồn", value: "🛡️ Bot tự động phát hiện (anti nuke/raid)", inline: true },
        { name: "Module", value: "`externalAppRaid`", inline: true },
      ],
      footer: "Protogon · Anti Nuke/Raid",
    });
    await sendLog(interaction.guild, config, embed);
  }

  // Raid bằng NÚT BẤM: kẻ raid spam bấm nút của app ngoài (tin mồi) để kích hoạt
  // hành động của app, hoặc làn sóng người bấm cùng 1 tin app. Đăng ký listener ngay
  // khi module khởi tạo (factory chạy 1 lần) — không cần sửa hàm attach().
  client.on("interactionCreate", (interaction) => {
    void handleButtonRaid(interaction).catch((e) => console.error("[antinuke:buttonRaid]", e.message));
  });

  async function handleAttributeEvent({ guild, module, eventType, targetId, describeTarget }) {
    if (!guild || guild.available === false) return;
    const config = await store.getConfig(guild.id);
    if (!config || !config.antinukeEnabled) return;
    lastConfigs.set(guild.id, config);
    const moduleCfg = config.modules.find((m) => m.module === module);
    if (!moduleCfg || !moduleCfg.enabled) return;

    const executor = await auditExecutor(guild, eventType, targetId);
    if (executor && (executor.id === client.user.id || isExempt(executor, moduleCfg, config))) {
      return; // whitelisted / self — fully ignore
    }
    // Bỏ qua bot logging/app hợp pháp (Carl-bot, MEE6, Dyno, Wick…): chúng tạo
    // webhook, ban bot spam, purge tin nhắn — công việc moderation/log bình thường,
    // áp dụng cho MỌI module nuke (trước đây chỉ miễn massWebhookCreate nên Carl-bot
    // ban bot raid bị massBan xử lý oan).
    if (isKnownLoggingBot(executor)) {
      return; // bot logging hợp pháp — không phải nuke
    }

    const count = record(guild.id, module, moduleCfg);
    // Bot gây hại: hạ ngưỡng xuống 1 — bot nuke bị xử lý NGAY ở lần đầu,
    // không chờ đủ ngưỡng như người dùng (audit vẫn cho biết thủ phạm là bot).
    // Bot gây hại (vừa được thêm vào server): xử lý NGAY ở lần đầu.
    // Bot tin cậy (xác minh / đã ở lại server >= 7 ngày — Carl-bot, Dyno, Wick…)
    // làm moderation bình thường → đi theo ngưỡng thường, không bị ban oan.
    const executorMember = executor
      ? await guild.members.fetch(executor.id).catch(() => null)
      : null;
    const executorIsHostileBot =
      executor?.bot === true &&
      !isTrustedBotMember(executorMember ?? executor, guild);
    const effectiveThreshold =
      executorIsHostileBot && IMMEDIATE_BOT_NUKE.has(module) ? 1 : moduleCfg.threshold;
    if (executor && count < effectiveThreshold) return;
    if (!executor) return; // can't attribute, can't punish — stay quiet
    // Chong lap: thu pham do da bi xu ly cho cung module o vua roi (audit log
    // thuong fire 2 lan cho 1 hanh vi) -> bo qua, khong phat/log/case them lan nua.
    if (wasHandled(guild.id, module, executor.id)) return;
    markHandled(guild.id, module, executor.id, Math.max(2, moduleCfg.windowSeconds || 10) * 1000);

    let action = "đã ghi nhận";
    let punishCaseNumber;
    let punishChosen;
    const actions = actionsOf(moduleCfg);
    try {
      const member = executorMember;
      const reason = `[Protogon AntiNuke] ${MODULE_LABELS[module]}: ${count} lượt trong ${moduleCfg.windowSeconds}s (ngưỡng ${moduleCfg.threshold})`;
      if (member) {
        const res = await punishWithHeat(guild, member, moduleCfg, reason);
        action = res.action;
        punishCaseNumber = res.caseNumber;
        punishChosen = res.chosen;
      } else if (actions.includes("ban") && executorIsHostileBot) {
        // Chỉ ban executor ngoài server khi chắc chắn là bot gây hại — bot tin cậy
        // (xác minh / ở lại lâu) tạm không fetch được member thì bỏ qua, không ban oan.
        try {
          await guild.members.ban(executor.id, { reason });
          action = "đã ban";
        } catch {
          action = "không thể ban";
        }
      }
      await maybeLockdown(guild, config);
      // purgeMessages: xóa hàng loạt tin nhắn của thủ phạm trên toàn guild (giới hạn).
      // KHÔNG purge khi thủ phạm là bot tin cậy (bot log ghi log qua webhook — purge
      // sẽ xóa sạch log) và luôn bỏ qua tin nhắn của chính bot này.
      if (actions.includes("purgeMessages") && !isTrustedBotMember(executorMember ?? executor, guild)) {
        const cleanup = await cleanupMessages({
          guild,
          channel: null,
          userId: executor.id,
          actions: ["purgeMessages"],
          triggerMessage: null,
          skipUserIds: [client.user.id],
        });
        if (cleanup) action = `${action} · ${cleanup}`;
      }
    } catch {
      action = "không thể xử lý";
    }

    await recordEvent(guild.id, {
      module,
      executorId: executor.id,
      executorName: executor.username ?? undefined,
      action,
      count,
      windowSeconds: moduleCfg.windowSeconds,
      threshold: moduleCfg.threshold,
      punish: moduleCfg.punish,
    });

    // Raid Intel: săn nguồn cơn (kẻ chủ mưu) + ghi mẫu dữ liệu huấn luyện.
    try {
      await afterStructuralEvent(guild, config, executor, moduleCfg, { count, action });
    } catch (e) {
      console.error(`[antinuke:${module}:sample]`, e.message);
    }

    const embed = logEmbed({
      title: `🚨 Anti Nuke/Raid: ${MODULE_LABELS[module]}`,
      description: `Đã phát hiện **${count} lượt** trong **${moduleCfg.windowSeconds} giây** (ngưỡng ${moduleCfg.threshold}).`,
      color: Colors.Red,
      fields: [
        { name: "Thủ phạm", value: `<@${executor.id}>`, inline: true },
        { name: "Xử lý", value: action.slice(0, 1000), inline: true },
        { name: "Nguồn", value: "🛡️ Bot tự động phát hiện (anti nuke/raid)", inline: true },
        { name: "Module", value: `\`${module}\``, inline: true },
        ...(describeTarget ? [{ name: "Đối tượng", value: describeTarget, inline: false }] : []),
      ],
      footer: "Protogon · Anti Nuke/Raid",
    });
    await sendLog(guild, config, embed);

    // Gửi embed case log kiểu Carl-bot tới kênh log moderation
    if (punishChosen) {
      try {
        await sendCaseLog({
          guild,
          guildConfig: config,
          action: punishChosen,
          caseNumber: punishCaseNumber,
          offender: { id: executor.id, username: executor.username || executor.id },
          reason: `[AntiNuke] ${MODULE_LABELS[module]}: ${count} lượt/${moduleCfg.windowSeconds}s`,
          executor: null,
        });
      } catch (e) {
        console.error(`[antinuke:${module}:caseLog]`, e.message);
      }
    }
  }

  /**
   * Bot hit-and-run: bot vừa được thêm (BotAdd) rồi TỰ RỜI trong cửa sổ —
   * không có audit kick (loại trường hợp mod/bot khác kick), không phải bot
   * logging hợp pháp, không tin cậy → xử lý qua pipeline chuẩn.
   */
  /**
   * Cảnh báo bot lạ mới được thêm vào server — CHỈ CẢNH BÁO, không phạt.
   * Bỏ qua: bot logging hợp pháp, bot có tick xác minh, bot được whitelist.
   * Bot lạ có acc < 30 ngày được cảnh báo mạnh hơn (mẫu bot nuke điển hình).
   */
  async function handleSuspiciousBotJoin(member) {
    try {
      const user = member.user ?? {};
      if (user.bot !== true) return;
      const verdict = strangeBotVerdict({ user });
      if (!verdict.alert) return;
      const guild = member.guild;
      if (!guild) return;

      const config = await store.getConfig(guild.id);
      if (!config || !config.antinukeEnabled) return;
      const moduleCfg = config.modules.find((m) => m.module === "suspiciousBotAlert");
      if (!moduleCfg || !moduleCfg.enabled) return;
      if (isExempt(member, moduleCfg, config)) return;
      // Chống spam cảnh báo: cùng 1 bot vào/ra liên tục trong 10 phút chỉ cảnh báo 1 lần.
      if (wasHandled(guild.id, "suspiciousBotAlert", member.id)) return;
      markHandled(guild.id, "suspiciousBotAlert", member.id, 10 * 60_000);

      // Ai đã thêm bot này vào? (audit BotAdd theo target = bot)
      const adder = await auditExecutor(guild, AuditLogEvent.BotAdd, member.id).catch(() => null);

      const ageDays = user.createdAt ? Math.floor((Date.now() - user.createdAt) / 86_400_000) : null;
      const perms = member.permissions;
      const flags = [];
      if (perms?.has?.(PermissionFlagsBits.Administrator)) flags.push("⚠️ Administrator");
      else {
        if (perms?.has?.(PermissionFlagsBits.ManageGuild)) flags.push("Manage Server");
        if (perms?.has?.(PermissionFlagsBits.ManageRoles)) flags.push("Manage Roles");
        if (perms?.has?.(PermissionFlagsBits.ManageWebhooks)) flags.push("Manage Webhooks");
        if (perms?.has?.(PermissionFlagsBits.BanMembers)) flags.push("Ban Members");
      }
      const permText = flags.length > 0 ? flags.join(", ") : "quyền thường";

      const embed = logEmbed({
        title: `👁️ Bot lạ mới vào server: ${user.username ?? member.id}`,
        description: verdict.youngAcc
          ? "Bot KHÔNG rõ nguồn gốc với **tài khoản application dưới 30 ngày tuổi** — mẫu phổ biến của bot nuke/scam. Theo dõi sát: nếu nó tự rời ngay, module hit-and-run sẽ xử lý."
          : "Bot chưa rõ nguồn gốc (không có tick xác minh Discord). Nếu đây là bot bạn tin cậy, thêm nó vào **Whitelist** để tắt cảnh báo." +
            " Nếu bot tự rời ngay sau khi được thêm, module hit-and-run sẽ tự xử lý.",
        color: verdict.youngAcc ? Colors.Orange : Colors.Yellow,
        fields: [
          { name: "Bot", value: `<@${member.id}> (${user.tag ?? member.id})`, inline: true },
          { name: "Người thêm", value: adder ? `<@${adder.id}>` : "không rõ", inline: true },
          { name: "Tuổi tài khoản bot", value: ageDays !== null ? `${ageDays} ngày` : "không rõ", inline: true },
          { name: "Quyền trong server", value: permText.slice(0, 1000), inline: false },
          { name: "Tick xác minh", value: "❌ Không (bot chưa được Discord xác minh)", inline: true },
        ],
        footer: "Protogon · Cảnh báo sơ bộ (không phạt)",
      });
      await sendLog(guild, config, embed, "antinuke");
      await recordEvent(guild.id, {
        module: "suspiciousBotAlert",
        executorId: member.id,
        executorName: user.username ?? undefined,
        action: "đã cảnh báo (không phạt)",
        count: 1,
        windowSeconds: moduleCfg.windowSeconds,
        threshold: moduleCfg.threshold,
        punish: "warn",
      });
    } catch (e) {
      console.error("[antinuke:botAlert]", e.message);
    }
  }
  async function handleHitAndRunLeave(member, kickExecutor) {
    try {
      const user = member.user ?? {};
      if (user.bot !== true) return; // chỉ bot
      const guild = member.guild;
      if (!guild) return;
      const key = `${guild.id}:${member.id}`;
      const addedAt = botAddTimes.get(key);
      botAddTimes.delete(key); // một lần rời là hết — không dùng lại entry cũ
      if (!addedAt || kickExecutor) return; // thiếu thời điểm thêm / bị kick → không kết luận
      if (isKnownLoggingBot(user)) return; // bot logging tự gỡ cấu hình là việc bình thường
      const trusted = isTrustedBotMember(member, guild);
      if (!botHitAndRunVerdict({ addedAt, leftAt: Date.now(), trusted, isBot: true })) return;

      const config = await store.getConfig(guild.id);
      if (!config || !config.antinukeEnabled) return;
      const moduleCfg = config.modules.find((m) => m.module === "botHitAndRun");
      if (!moduleCfg || !moduleCfg.enabled) return;
      if (isExempt(member, moduleCfg, config)) return;

      const staySec = Math.max(1, Math.round((Date.now() - addedAt) / 1000));
      const reason = `[Protogon AntiNuke] ${MODULE_LABELS.botHitAndRun}: bot rời server sau ${staySec}s kể từ khi được thêm`;
      let action = "đã ghi nhận";
      let punishCaseNumber;
      let punishChosen;
      try {
        const res = await punishWithHeat(guild, member, moduleCfg, reason);
        action = res.action;
        punishCaseNumber = res.caseNumber;
        punishChosen = res.chosen;
      } catch {
        action = "không thể xử lý";
      }
      await maybeLockdown(guild, config);
      await recordEvent(guild.id, {
        module: "botHitAndRun",
        executorId: member.id,
        executorName: user.username ?? undefined,
        action,
        count: 1,
        windowSeconds: moduleCfg.windowSeconds,
        threshold: moduleCfg.threshold,
        punish: moduleCfg.punish,
      });
      const embed = logEmbed({
        title: `🚨 Anti Nuke/Raid: ${MODULE_LABELS.botHitAndRun}`,
        description: `Bot vào server rồi TỰ RỜI ngay sau **${staySec} giây** — mẫu bot nuke kinh điển (phá hoại xong rời để dọn dấu vết, né audit log).`,
        color: Colors.Red,
        fields: [
          { name: "Bot", value: `<@${member.id}> (${user.tag ?? member.id})`, inline: true },
          { name: "Xử lý", value: action.slice(0, 1000), inline: true },
          { name: "Module", value: "`botHitAndRun`", inline: true },
        ],
        footer: "Protogon · Anti Nuke/Raid",
      });
      await sendLog(guild, config, embed);
      if (punishChosen) {
        try {
          await sendCaseLog({
            guild,
            guildConfig: config,
            action: punishChosen,
            caseNumber: punishCaseNumber,
            offender: { id: member.id, username: user.username || member.id },
            reason: "[AntiNuke] botHitAndRun: tự rời ngay sau khi được thêm",
            executor: null,
          });
        } catch (e) {
          console.error("[antinuke:hitAndRun:caseLog]", e.message);
        }
      }
    } catch (e) {
      console.error("[antinuke:hitAndRun]", e.message);
    }
  }
  async function handleRaidJoin(member) {
    const guild = member.guild;
    const config = await store.getConfig(guild.id);
    if (!config || !config.antinukeEnabled) return;
    lastConfigs.set(guild.id, config);
    const moduleCfg = config.modules.find((m) => m.module === "massJoin");
    if (!moduleCfg || !moduleCfg.enabled) return;

    const arr = joiners.get(guild.id) ?? [];
    arr.push({ id: member.id, ts: Date.now() });
    const cutoff = Date.now() - moduleCfg.windowSeconds * 1000;
    const fresh = arr.filter((j) => j.ts >= cutoff);
    joiners.set(guild.id, fresh);
    if (fresh.length < moduleCfg.threshold) return;

    // CHỐNG BAN NHẦM: soi hồ sơ toàn cụm TRƯỚC khi phạt (trước đây đủ ngưỡng là
    // kick + khóa kênh ngay cả với làn sóng thành viên thật → ban oan cả server).
    // Raid thật: đa số acc mới/default avatar. Tăng trưởng tự nhiên: hồ sơ bình thường
    // → chỉ ghi nhận, KHÔNG phạt, KHÔNG khóa kênh.
    const profiles = []; // hồ sơ cụm tài khoản raid → Raid Intel
    for (const j of fresh) {
      const m = await guild.members.fetch(j.id).catch(() => null);
      if (!m || isExempt(m, moduleCfg, config)) continue;
      profiles.push({
        id: m.id,
        username: m.user?.username,
        avatar: m.user?.avatar,
        createdAt: m.user?.createdTimestamp,
        joinedAt: j.ts,
      });
    }
    const sus = joinClusterSuspicion(profiles);
    if (sus.total === 0 || sus.ratio < 0.5) {
      await recordEvent(guild.id, {
        module: "massJoin",
        action: `bỏ qua — hồ sơ bình thường (${sus.suspicious}/${sus.total} tài khoản đáng ngờ)`,
        count: fresh.length,
        windowSeconds: moduleCfg.windowSeconds,
        threshold: moduleCfg.threshold,
        punish: "none",
      });
      await sendLog(
        guild,
        config,
        logEmbed({
          title: "🛡️ Anti Nuke/Raid: Raid thành viên — KHÔNG xử lý",
          description: `**${fresh.length}** thành viên vào trong **${moduleCfg.windowSeconds}s** nhưng hồ sơ tài khoản bình thường (nhiều khả năng tăng trưởng tự nhiên). Bot bỏ qua để tránh ban nhầm.`,
          color: Colors.Yellow,
          fields: [
            { name: "Tài khoản đáng ngờ", value: `${sus.suspicious}/${sus.total || 0}`, inline: true },
            { name: "Acc mới <7 ngày", value: String(sus.freshAccounts), inline: true },
            { name: "Nguồn", value: "🛡️ Tự động — gate chống ban nhầm", inline: true },
          ],
          footer: "Protogon · Anti Nuke/Raid",
        }),
      );
      return;
    }

    const reason = `[Protogon AntiNuke] Raid thành viên: ${fresh.length} người tham gia trong ${moduleCfg.windowSeconds}s`;
    const results = [];
    const skippedReal = []; // hồ sơ bình thường — được miễn trong cụm hỗn hợp
    const actions = actionsOf(moduleCfg);
    // purgeMessages: giới hạn chỉ purge vài tài khoản mới nhất để tránh quá tải.
    let purgedCount = 0;
    const purgeLimit = actions.includes("purgeMessages") ? 3 : 0;
    for (const j of fresh) {
      const m = await guild.members.fetch(j.id).catch(() => null);
      if (!m || isExempt(m, moduleCfg, config)) continue;
      // CHỐNG BAN NHẦM CÁ NHÂN: trong cụm hỗn hợp (raid lẫn người thật), chỉ phạt
      // tài khoản ĐÁNG NGỜ (điểm >= 2). Thành viên thật đi kèm làn sóng (acc cũ,
      // có avatar, tên người) được bỏ qua thay vì bị kick oan cả cụm.
      if (
        memberSuspicionScore({
          id: m.id,
          username: m.user?.username,
          avatar: m.user?.avatar,
          createdAt: m.user?.createdTimestamp,
        }) < 3
      ) {
        skippedReal.push(m.id);
        continue;
      }
      const res = await punishWithHeat(guild, m, moduleCfg, reason);
      results.push(`<@${j.id}>: ${res.action}`);
      if (purgedCount < purgeLimit) {
        const cleanup = await cleanupMessages({
          guild,
          channel: null,
          userId: j.id,
          actions: ["purgeMessages"],
          triggerMessage: null,
        });
        if (cleanup) purgedCount += 1;
      }
    }
    await maybeLockdown(guild, config);

    await recordEvent(guild.id, {
      module: "massJoin",
      executorId: undefined,
      executorName: undefined,
      action:
        results.length > 0
          ? `xử lý ${results.length} tài khoản (${moduleCfg.punish})${skippedReal.length ? ` · bỏ qua ${skippedReal.length} hồ sơ bình thường` : ""}${purgedCount > 0 ? ` · purge ${purgedCount} tài khoản` : ""}`
          : skippedReal.length
            ? `bỏ qua ${skippedReal.length} hồ sơ bình thường trong cụm`
            : "không có tài khoản để xử lý",
      count: fresh.length,
      windowSeconds: moduleCfg.windowSeconds,
      threshold: moduleCfg.threshold,
      punish: moduleCfg.punish,
    });

    // Raid Intel: săn NGUỒN CƠN raid trong cụm tài khoản vừa vào + ghi mẫu huấn luyện.
    const sourceHunt = await huntRaidSource(guild, config, profiles);
    await recordRaidSample(guild, config, {
      module: "massJoin",
      count: fresh.length,
      windowSeconds: moduleCfg.windowSeconds,
      threshold: moduleCfg.threshold,
      action: results.length ? `xử lý ${results.length} tài khoản (${moduleCfg.punish})` : "không có tài khoản để xử lý",
      punish: moduleCfg.punish,
      lockdownTriggered: isLocked(guild.id),
      punishedCount: results.length,
      ...clusterStats(profiles),
      sourceHunt,
    });
    if (sourceHunt?.banned) {
      // Ghi lại vụ ban nguồn cơn vào sự kiện để báo cáo hàng ngày + dashboard thấy.
      await recordEvent(guild.id, {
        module: "raidIntel",
        executorId: sourceHunt.suspectedSourceId ?? undefined,
        executorName: sourceHunt.suspectedSourceName ?? undefined,
        action: `Raid Intel: ban nguồn cơn (${sourceHunt.reason})`,
        count: fresh.length,
        windowSeconds: moduleCfg.windowSeconds,
        threshold: moduleCfg.threshold,
        punish: "ban",
      }).catch(() => {});
    }

    const embed = logEmbed({
      title: `🚨 Anti Nuke/Raid: Raid thành viên!`,
      description: `**${fresh.length}** thành viên tham gia trong **${moduleCfg.windowSeconds} giây** (ngưỡng ${moduleCfg.threshold}). Đã xử lý ${results.length} tài khoản.`,
      color: Colors.Red,
      fields: [
        ...(results.length > 0
          ? [{ name: "Kết quả xử lý", value: results.slice(0, 10).join("\n").slice(0, 1000) }]
          : []),
        { name: "Nguồn", value: "🛡️ Bot tự động phát hiện (anti nuke/raid)", inline: true },
        ...(sourceHunt && sourceHunt.banned
          ? [{ name: "Raid Intel", value: `🎯 Đã ban nguồn cơn nghi ngờ: **${sourceHunt.suspectedSourceName ?? "?"}** — ${sourceHunt.reason}` }]
          : []),
      ],
      footer: "Protogon · Anti Nuke/Raid",
    });
    await sendLog(guild, config, embed);
  }

  /**
   * Phát hiện các mẫu tin nhắn gây nhiễu: tin dài cực dài / lặp nội dung và
   * tin "giả blank" (chỉ khoảng trắng + ký tự ẩn). Dùng AI để phân biệt raid
   * (leo thang phạt trực tiếp + lockdown) với vi phạm cá nhân (nhiệt bình thường).
   */
  async function handleMessagePatterns(message) {
    if (!message.guild) return;
    // Tin qua WEBHOOK = EXTERNAL APP (app kết nối từ ngoài, KHÔNG phải thành viên
    // server) → xử lý riêng ở External App Guard. BOT ĐƯỢC MỜI vào server (author bot,
    // là thành viên) vẫn bị soi các module chống nuke như thành viên thường — bot mà
    // trigger module (spam dài/lặp, blank...) sẽ bị phạt THẲNG TAY theo cấu hình.
    if (message.webhookId) {
      await handleExternalAppMessage(message);
      return;
    }
    if (message.channel.isDMBased?.()) return;
    const content = message.content || "";
    const config = await store.getConfig(message.guild.id);
    if (!config || !config.antinukeEnabled) return;
    lastConfigs.set(message.guild.id, config);
    const member = message.member;
    if (!member || isExempt(member, {}, config)) return;

    const userKey = `${message.guild.id}:${message.author.id}`;
    const recents = recentMessages.get(userKey) ?? [];
    recents.push({ content, ts: Date.now() });
    const freshRecents = recents.filter((m) => Date.now() - m.ts < 30_000).slice(-8);
    recentMessages.set(userKey, freshRecents);

    const modules = config.modules || [];
    const longCfg = modules.find((m) => m.module === "massMessage");
    const blankCfg = modules.find((m) => m.module === "blankNoise");

    const patterns = [];
    if (longCfg?.enabled) {
      // Tin dài cực dài hoặc lặp lại nội dung giống hệt nhiều lần.
      const isLong = content.length > LONG_MSG_LEN;
      const sameCount = freshRecents.filter((m) => m.content === content).length;
      if (isLong || sameCount >= 2) patterns.push({ cfg: longCfg, key: `${userKey}:long` });
    }
    if (blankCfg?.enabled) {
      const stripped = content.replace(ZERO_WIDTH_RE, "").trim();
      const isBlankNoise = content.length > 0 && stripped.length === 0;
      if (isBlankNoise) patterns.push({ cfg: blankCfg, key: `${userKey}:blank` });
    }

    for (const { cfg, key } of patterns) {
      const now = Date.now();
      const arr = patternBuckets.get(key) ?? [];
      arr.push(now);
      const cutoff = now - cfg.windowSeconds * 1000;
      const fresh = arr.filter((t) => t >= cutoff);
      patternBuckets.set(key, fresh);
      if (fresh.length < cfg.threshold) continue;

      patternBuckets.delete(key);
      const samples = freshRecents.map((m) => m.content.slice(0, 200));
      const ai = await aiClassify(
        message.guild,
        cfg.module,
        fresh.length,
        cfg.windowSeconds,
        cfg.threshold,
        samples,
      );
      // Chỉ coi là raid/nuke khi AI phân loại là "raid" VÀ độ tin cậy đủ cao
      // (>= 0.6) — tránh nhận diện nhầm gây ban nhầm + khóa kênh oan.
      const isRaid = ai?.classification === "raid" && (ai?.confidence ?? 0) >= 0.6;
      // AI xác định là dương tính giả → không phạt, chỉ ghi nhận.
      const isBenign = ai?.classification === "benign";
      const reason = `[Protogon] ${MODULE_LABELS[cfg.module]}: ${fresh.length} lần trong ${cfg.windowSeconds}s (ngưỡng ${cfg.threshold})${isRaid ? ` — AI: raid (${ai.reason ?? ""})` : ""}`;
      const actions = actionsOf(cfg);

      let action;
      let chosen;
      let caseNumber;
      if (isRaid) {
        // Leo thang: phạt trực tiếp theo hình phạt nuke mặc định + lockdown.
        chosen = "ban";
        const res = await punishMember(message.guild, member, "ban", reason, 0, store);
        action = res.action;
        caseNumber = res.caseNumber;
        await maybeLockdown(message.guild, config);
        // AI xác nhận raid → cảnh báo khẩn cho server (fire-and-forget).
        emergencyRaidAlert(client, store, message.guild, {
          summary: "AI xác nhận raid (spam) — " + fresh.length + " tin trong " + cfg.windowSeconds + "s",
          reason,
          lockdownActive: isLocked(message.guild.id),
        }).catch(() => {});
      } else if (isBenign) {
        // Dương tính giả: chỉ xóa tin nhắn, không phạt, không cộng nhiệt.
        action = "bỏ qua (AI: benign)";
        chosen = "none";
      } else {
        const res = await punishWithHeat(message.guild, member, cfg, reason);
        action = res.action;
        caseNumber = res.caseNumber;
        chosen = res.chosen;
      }
      // Dương tính giả (benign): không dọn tin, không phạt.
      let cleanup = "";
      if (!isBenign) {
        cleanup = await cleanupMessages({
          guild: message.guild,
          channel: message.channel,
          userId: message.author.id,
          actions,
          triggerMessage: message,
        });
        if (cleanup) action = `${action} · ${cleanup}`;
      }

      await recordEvent(message.guild.id, {
        module: cfg.module,
        executorId: message.author.id,
        executorName: message.author.username,
        action: `${action}${isRaid ? " (AI: raid)" : ""}`,
        count: fresh.length,
        windowSeconds: cfg.windowSeconds,
        threshold: cfg.threshold,
        punish: chosen ?? "none",
      });

      const offender = { id: message.author.id, username: message.author.username };
      // Log xóa tin nhắn kiểu Carl-bot ("Message deleted") vào kênh log moderation.
      if (cleanup) {
        try {
          await sendCaseLog({
            guild: message.guild,
            guildConfig: config,
            action: "delete",
            offender,
            reason: `Bot tự động xóa tin nhắn vì ${MODULE_LABELS[cfg.module]} (${fresh.length} tin trong ${cfg.windowSeconds}s)`,
            executor: null,
          });
        } catch (e) {
          console.error("[antinuke:pattern:delLog]", e.message);
        }
      }
      // Embed case kiểu Carl-bot cho phạt tự động (responsible moderator = tên bot).
      if (!isBenign) {
        try {
          await sendCaseLog({
            guild: message.guild,
            guildConfig: config,
            action: chosen === "none" ? "warn" : chosen,
            caseNumber,
            offender,
            reason: `Tự động xử lý vì ${MODULE_LABELS[cfg.module]}: ${fresh.length} lần trong ${cfg.windowSeconds}s${isRaid ? ` — AI xác nhận raid (${ai?.reason ?? ""})` : ""}${cleanup ? ` · đã ${cleanup}` : ""}`.slice(0, 1000),
            executor: null,
          });
        } catch (e) {
          console.error("[antinuke:pattern:case]", e.message);
        }
      }
      // Raid Intel: ghi mẫu huấn luyện kèm AI verdict (raid/individual/benign).
      if (!isBenign) {
        await recordRaidSample(message.guild, config, {
          module: cfg.module,
          count: fresh.length,
          windowSeconds: cfg.windowSeconds,
          threshold: cfg.threshold,
          action,
          punish: chosen ?? "none",
          aiClassification: ai?.classification,
          aiConfidence: ai?.confidence,
          aiReason: ai?.reason,
          lockdownTriggered: isLocked(message.guild.id),
        });
      }
      return; // chỉ xử lý 1 pattern/tin nhắn
    }
  }

  async function handleSpam(message) {
    if (!message.guild) return;
    // Bot ĐƯỢC MỜI vào server cũng bị soi chống spam như thành viên thường — bot mà
    // trigger module sẽ bị phạt thẳng tay theo cấu hình (webhook thì message.member
    // là null nên tự bỏ qua ở đây — webhook do External App Guard xử lý).
    if (message.channel.isDMBased?.()) return;
    const config = await store.getConfig(message.guild.id);
    if (!config || !config.antinukeEnabled) return;
    lastConfigs.set(message.guild.id, config);
    const moduleCfg = config.modules.find((m) => m.module === "spam");
    if (!moduleCfg || !moduleCfg.enabled) return;
    const member = message.member;
    if (!member || isExempt(member, moduleCfg, config)) return;

    const key = `${message.guild.id}:${message.author.id}`;
    const now = Date.now();
    const arr = spamBuckets.get(key) ?? [];
    arr.push(now);
    const cutoff = now - moduleCfg.windowSeconds * 1000;
    const fresh = arr.filter((t) => t >= cutoff);
    spamBuckets.set(key, fresh);
    if (fresh.length < moduleCfg.threshold) return;

    spamBuckets.delete(key); // reset after punishing
    // Ghi mẫu tin nhắn spam cho n-gram engine (threat intel cục bộ, 0 token).
    try {
      require("../threatEngine").noteFlaggedMessage(message.content, message.guild.id, "spam");
    } catch {}
    const samples = (recentMessages.get(key) ?? []).map((m) => m.content.slice(0, 200));
    const ai = await aiClassify(
      message.guild,
      "spam",
      fresh.length,
      moduleCfg.windowSeconds,
      moduleCfg.threshold,
      samples,
    );
    // Chỉ leo thang thành raid (ban + lockdown) khi AI tự tin >= 0.6.
    const isRaid = ai?.classification === "raid" && (ai?.confidence ?? 0) >= 0.6;
    const isBenign = ai?.classification === "benign";
    const reason = `[Protogon AntiNuke] Spam: ${fresh.length} tin nhắn trong ${moduleCfg.windowSeconds}s${isRaid ? ` — AI: raid (${ai.reason ?? ""})` : ""}`;

    const actions = actionsOf(moduleCfg);
    let action;
    let chosen;
    let caseNumber;
    if (isRaid) {
      chosen = "ban";
      const res = await punishMember(message.guild, member, "ban", reason, 0, store);
      action = res.action;
      caseNumber = res.caseNumber;
      await maybeLockdown(message.guild, config);
    } else if (isBenign) {
      action = "bỏ qua (AI: benign)";
      chosen = "none";
    } else {
      const res = await punishWithHeat(message.guild, member, moduleCfg, reason);
      action = res.action;
      caseNumber = res.caseNumber;
      chosen = res.chosen;
    }

    // Dọn tin nhắn theo hành động đã chọn (deleteMessages / purgeMessages).
    let cleanup = "";
    if (!isBenign) {
      cleanup = await cleanupMessages({
        guild: message.guild,
        channel: message.channel,
        userId: message.author.id,
        actions,
        triggerMessage: message,
      });
      if (cleanup) action = `${action} · ${cleanup}`;
    }

    await recordEvent(message.guild.id, {
      module: "spam",
      executorId: message.author.id,
      executorName: message.author.username,
      action: `${action}${isRaid ? " (AI: raid)" : ""}`,
      count: fresh.length,
      windowSeconds: moduleCfg.windowSeconds,
      threshold: moduleCfg.threshold,
      punish: chosen ?? "none",
    });

    const offender = { id: message.author.id, username: message.author.username };
    // Log xóa tin nhắn kiểu Carl-bot ("Message deleted") vào kênh log moderation.
    if (cleanup) {
      try {
        await sendCaseLog({
          guild: message.guild,
          guildConfig: config,
          action: "delete",
          offender,
          reason: `Bot tự động xóa tin nhắn vì spam (${fresh.length} tin trong ${moduleCfg.windowSeconds}s)`,
          executor: null,
        });
      } catch (e) {
        console.error("[antinuke:spam:delLog]", e.message);
      }
    }
    // Embed case kiểu Carl-bot cho phạt tự động (responsible moderator = tên bot).
    if (!isBenign) {
      try {
        await sendCaseLog({
          guild: message.guild,
          guildConfig: config,
          action: chosen === "none" ? "warn" : chosen,
          caseNumber,
          offender,
          reason: `Tự động xử lý vì spam tin nhắn: ${fresh.length} tin trong ${moduleCfg.windowSeconds}s${isRaid ? ` — AI xác nhận raid (${ai?.reason ?? ""})` : ""}${cleanup ? ` · đã ${cleanup}` : ""}`.slice(0, 1000),
          executor: null,
        });
      } catch (e) {
        console.error("[antinuke:spam:case]", e.message);
      }
    }
    // Raid Intel: ghi mẫu huấn luyện kèm AI verdict (raid/individual/benign).
    if (!isBenign) {
      await recordRaidSample(message.guild, config, {
        module: moduleCfg.module,
        count: fresh.length,
        windowSeconds: moduleCfg.windowSeconds,
        threshold: moduleCfg.threshold,
        action,
        punish: chosen ?? "none",
        aiClassification: ai?.classification,
        aiConfidence: ai?.confidence,
        aiReason: ai?.reason,
        lockdownTriggered: isLocked(message.guild.id),
      });
    }
  }

  /** Periodically unlock guilds whose lockdown expired or was requested. */
  async function tickUnlocks() {
    const now = Date.now();
    for (const guild of client.guilds.cache.values()) {
      try {
        const config = await store.getConfig(guild.id);
        if (!config) continue;
        const expired = config.lockdownUntil && config.lockdownUntil <= now;
        if (!isLocked(guild.id)) {
          if (expired) {
            // Hết hạn sau khi bot restart: overwrite vẫn còn trên Discord
            // nhưng bot không nhớ — phải markLocked rồi mở khóa để reset.
            // Chi xu ly 1 lan cho moi moc lockdownUntil: khong nho moc nay thi
            // vong quet 20s sau lai thay "expired" -> mo khoa + gui log
            // "Da mo khoa kenh" LAP LAI vo han (spam log o server tung bi khoa).
            const sweptKey = `${guild.id}:expired:${config.lockdownUntil}`;
            if (!staleUnlockSwept.has(sweptKey)) {
              staleUnlockSwept.add(sweptKey);
              markLocked(guild.id);
              await unlockGuild(client, guild, config, store);
            }
          } else if (config.lockdownUntil) {
            // Vẫn đang trong thời gian khóa (restart giữa chừng): nhớ lại trạng thái.
            markLocked(guild.id);
          }
          continue;
        }
        if (config.lockdownRequested || expired) {
          await unlockGuild(client, guild, config, store);
        }
      } catch (err) {
        console.error(`[antinuke:unlock] ${guild.id}:`, err.message);
      }
    }
  }

  /**
   * Dashboard bấm "Xóa nhiệt" → đặt cờ heatResetRequested. Bot xóa nhiệt trong
   * bộ nhớ (và bỏ cảnh báo DM đã gửi) rồi xóa cờ để không reset lại lần sau.
   */
  async function tickHeatResets() {
    for (const guild of client.guilds.cache.values()) {
      try {
        const config = await store.getConfig(guild.id);
        if (!config || !config.heatResetRequested) continue;
        heat.resetGuild(guild.id, config.heatResetUserId || undefined);
        await store.client.mutation("bot_writes:botClearHeatReset", { guildId: guild.id });
        console.log(`[heat:reset] ${guild.id} đã xóa nhiệt${config.heatResetUserId ? ` của ${config.heatResetUserId}` : " toàn bộ"}`);
      } catch (err) {
        console.error(`[heat:reset] ${guild.id}:`, err.message);
      }
    }
  }

  async function handleMessageBulk(messages) {
    const guild = messages.first()?.guild;
    await handleAttributeEvent({
      guild,
      module: "massMessageDelete",
      eventType: AuditLogEvent.MessageBulkDelete,
      targetId: null,
      describeTarget: `Xóa ${messages.size} tin nhắn trong kênh <#${messages.first()?.channelId ?? "?"}>`,
    });
  }

  /** Xử lý sự kiện audit log: tạo webhook / thread hàng loạt (không cần fetch lại). */
  async function handleAuditEntry(entry, guild, module, describeTarget) {
    if (!guild || guild.available === false) return;
    const config = await store.getConfig(guild.id);
    if (!config || !config.antinukeEnabled) return;
    lastConfigs.set(guild.id, config);
    const moduleCfg = moduleCfgOf(config, module);
    if (!moduleCfg || !moduleCfg.enabled) return;
    const executor = entry.executor;
    // adminSelfGrant: chỉ owner / Administrator / adminRoles được miễn — kẻ leo
    // thang đặc quyền thường ĐANG là mod (có quyền Manage Roles) nên không cho
    // modRoles được miễn module này.
    let exempt = false;
    if (executor) {
      if (executor.id === client.user.id) {
        exempt = true;
      } else {
        const em = await guild.members.fetch(executor.id).catch(() => null);
        if (em) {
          if (module === "adminSelfGrant") {
            // Bot tự cấp/quyền admin là vector nuke — KHÔNG miễn cho bot.
            exempt =
              em.id === guild.ownerId ||
              (em.user?.bot !== true &&
                em.permissions.has(PermissionFlagsBits.Administrator)) ||
              (em.user?.bot !== true &&
                (config?.adminRoles || []).some((id) => em.roles.cache.has(id)));
          } else {
            exempt = isExempt(em, moduleCfg, config);
          }
        }
      }
    }
    if (exempt) return;

    const count = record(guild.id, module, moduleCfg);
    // Bot gây hại: hạ ngưỡng xuống 1 — bot nuke bị xử lý NGAY ở lần đầu,
    // không chờ đủ ngưỡng như người dùng (audit vẫn cho biết thủ phạm là bot).
    // Bot gây hại (vừa được thêm vào server): xử lý NGAY ở lần đầu.
    // Bot tin cậy (xác minh / đã ở lại server >= 7 ngày — Carl-bot, Dyno, Wick…)
    // làm moderation bình thường → đi theo ngưỡng thường, không bị ban oan.
    const executorMember = executor
      ? await guild.members.fetch(executor.id).catch(() => null)
      : null;
    const executorIsHostileBot =
      executor?.bot === true &&
      !isTrustedBotMember(executorMember ?? executor, guild);
    const effectiveThreshold =
      executorIsHostileBot && IMMEDIATE_BOT_NUKE.has(module) ? 1 : moduleCfg.threshold;
    if (executor && count < effectiveThreshold) return;
    if (!executor) return;
    // Chong lap (giong handleAttributeEvent): 1 hanh vi = 1 phat + 1 case log.
    if (wasHandled(guild.id, module, executor.id)) return;
    markHandled(guild.id, module, executor.id, Math.max(2, moduleCfg.windowSeconds || 10) * 1000);

    let action = "đã ghi nhận";
    let punishType = null;
    let punishCaseNum = undefined;
    const actions = actionsOf(moduleCfg);
    try {
      const member = executorMember;
      const reason = `[Protogon AntiNuke] ${MODULE_LABELS[module]}: ${count} lượt trong ${moduleCfg.windowSeconds}s (ngưỡng ${moduleCfg.threshold})`;
      if (member) {
        const res = await punishWithHeat(guild, member, moduleCfg, reason);
        action = res.action;
        punishType = res.chosen;
        punishCaseNum = res.caseNumber;
      } else if (actions.includes("ban") && executorIsHostileBot) {
        // Chỉ ban bot gây hại xác nhận — bot tin cậy không bị ban oan.
        try {
          await guild.members.ban(executor.id, { reason });
          action = "đã ban";
        } catch {
          action = "không thể ban";
        }
      }
      await maybeLockdown(guild, config);
      // KHÔNG purge khi thủ phạm là bot tin cậy (giữ nguyên log webhook) +
      // luôn bỏ qua tin nhắn của chính bot này.
      if (actions.includes("purgeMessages") && !isTrustedBotMember(executorMember ?? executor, guild)) {
        const cleanup = await cleanupMessages({
          guild,
          channel: null,
          userId: executor.id,
          actions: ["purgeMessages"],
          triggerMessage: null,
          skipUserIds: [client.user.id],
        });
        if (cleanup) action = `${action} · ${cleanup}`;
      }
    } catch {
      action = "không thể xử lý";
    }

    await recordEvent(guild.id, {
      module,
      executorId: executor.id,
      executorName: executor.username ?? undefined,
      action,
      count,
      windowSeconds: moduleCfg.windowSeconds,
      threshold: moduleCfg.threshold,
      punish: moduleCfg.punish,
    });

    // Raid Intel: săn nguồn cơn (kẻ chủ mưu) + ghi mẫu dữ liệu huấn luyện.
    try {
      await afterStructuralEvent(guild, config, executor, moduleCfg, { count, action });
    } catch (e) {
      console.error(`[antinuke:${module}:sample]`, e.message);
    }

    const embed = logEmbed({
      title: `🚨 Anti Nuke/Raid: ${MODULE_LABELS[module]}`,
      description: `Đã phát hiện **${count} lượt** trong **${moduleCfg.windowSeconds} giây** (ngưỡng ${moduleCfg.threshold}).`,
      color: Colors.Red,
      fields: [
        { name: "Thủ phạm", value: `<@${executor.id}>`, inline: true },
        { name: "Xử lý", value: action.slice(0, 1000), inline: true },
        { name: "Nguồn", value: "🛡️ Bot tự động phát hiện (anti nuke/raid)", inline: true },
        { name: "Module", value: `\`${module}\``, inline: true },
        ...(describeTarget ? [{ name: "Đối tượng", value: describeTarget, inline: false }] : []),
      ],
      footer: "Protogon · Anti Nuke/Raid",
    });
    await sendLog(guild, config, embed);

    // BÁO CÁO KHẨN cho các module nuke cấu trúc (ban/kick/xóa kênh hàng loạt…).
    if (IMMEDIATE_BOT_NUKE.has(module) || module === "massJoin") {
      emergencyRaidAlert(client, store, guild, {
        summary: MODULE_LABELS[module] + " — " + count + " lượt trong " + moduleCfg.windowSeconds + "s",
        reason: reason,
        lockdownActive: isLocked(guild.id),
      }).catch(() => {});
    }

    // Gửi embed case log kiểu Carl-bot tới kênh log moderation
    if (punishType) {
      try {
        await sendCaseLog({
          guild,
          guildConfig: config,
          action: punishType,
          caseNumber: punishCaseNum,
          offender: { id: executor.id, username: executor.username || executor.id },
          reason: "[AntiNuke] " + MODULE_LABELS[module] + ": " + count + " lượt/" + moduleCfg.windowSeconds + "s",
          executor: null,
        });
      } catch (e) {
        console.error("[antinuke:" + module + ":caseLog]", e.message);
      }
    }
  }

  /**
   * Raid Intel — ghi mẫu huấn luyện + săn nguồn cơn raid sau khi xử lý một vụ
   * phá hoại cấu trúc (audit log). Executor là nghi phạm hàng đầu, gộp cùng cụm
   * tài khoản vào gần đây để tìm acc chủ mưu có liên quan.
   */
  async function afterStructuralEvent(guild, config, executor, moduleCfg, payload) {
    const recentCluster = (joiners.get(guild.id) ?? []).slice(-12).map((j) => ({ id: j.id, joinedAt: j.ts }));
    const sourceHunt = await huntRaidSource(guild, config, recentCluster, executor ? [executor] : []);
    await recordRaidSample(guild, config, {
      module: moduleCfg.module,
      count: payload.count,
      windowSeconds: moduleCfg.windowSeconds,
      threshold: moduleCfg.threshold,
      action: payload.action,
      punish: moduleCfg.punish,
      lockdownTriggered: isLocked(guild.id),
      ...clusterStats(recentCluster),
      sourceHunt,
    });
  }

  /**
   * Định tuyến sự kiện audit log mới → module chống nuke/raid. Trả về
   * { module, describeTarget } hoặc null nếu không phải sự kiện cần xử lý.
   */
  async function routeAuditEntry(entry, guild) {
    const t = entry.target;
    const changes = (entry.changes || []).map((c) => c.key);
    switch (entry.action) {
      case AuditLogEvent.WebhookCreate:
        return { module: "massWebhookCreate", describeTarget: `Webhook "${t?.name ?? "?"}"` };
      case AuditLogEvent.ThreadCreate:
        return { module: "massThreadCreate", describeTarget: `Thread "#${t?.name ?? "?"}"` };
      case AuditLogEvent.ThreadDelete:
        return { module: "massThreadDelete", describeTarget: `Xóa thread "#${t?.name ?? "?"}"` };
      case AuditLogEvent.ChannelUpdate: {
        if (changes.includes("permission_overwrites")) {
          return { module: "massChannelOverwrite", describeTarget: `#${t?.name ?? "?"} — quyền kênh bị thay đổi` };
        }
        if (changes.some((k) => ["name", "position", "topic", "rate_limit_per_user"].includes(k))) {
          return { module: "massChannelRename", describeTarget: `#${t?.name ?? "?"} bị sửa` };
        }
        return null;
      }
      case AuditLogEvent.RoleUpdate:
        return { module: "massRoleEdit", describeTarget: `Role "${t?.name ?? "?"}" bị sửa` };
      case AuditLogEvent.MemberUpdate: {
        if (changes.includes("nick")) {
          return { module: "massNickname", describeTarget: `Biệt danh của <@${t?.id}> bị đổi` };
        }
        return null;
      }
      case AuditLogEvent.MemberRoleUpdate: {
        const addedRoles = (entry.changes || [])
          .filter((c) => c.key === "$add")
          .flatMap((c) => (Array.isArray(c.new) ? c.new.map((r) => r && r.id) : []))
          .filter(Boolean);
        let grantedAdmin = false;
        let adminRoleName = "";
        for (const rid of addedRoles) {
          const role = guild.roles.cache.get(rid) ?? (await guild.roles.fetch(rid).catch(() => null));
          if (
            role &&
            (role.permissions.has(PermissionFlagsBits.Administrator) ||
              role.permissions.has(PermissionFlagsBits.ManageGuild) ||
              role.permissions.has(PermissionFlagsBits.ManageRoles))
          ) {
            grantedAdmin = true;
            adminRoleName = role.name;
            break;
          }
        }
        if (grantedAdmin) {
          return {
            module: "adminSelfGrant",
            describeTarget: `Cấp quyền quản trị (role "${adminRoleName}") cho <@${t?.id}>`,
          };
        }
        return { module: "massRoleAssign", describeTarget: `Đổi role của <@${t?.id}>` };
      }
      case AuditLogEvent.EmojiCreate:
      case AuditLogEvent.StickerCreate:
        return {
          module: "massEmoji",
          describeTarget: `Tạo ${entry.action === AuditLogEvent.EmojiCreate ? "emoji" : "sticker"} "${t?.name ?? "?"}"`,
        };
      case AuditLogEvent.BotAdd:
        return { module: "massBotAdd", describeTarget: `Thêm bot ${t?.username ?? "?"}` };
      case AuditLogEvent.InviteCreate:
        return { module: "massInviteCreate", describeTarget: "Tạo link mời mới" };
      case AuditLogEvent.GuildUpdate: {
        const tampered = changes.filter((k) =>
          ["name", "icon_hash", "mfa_level", "verification_level", "region", "splash_hash"].includes(k),
        );
        if (tampered.length > 0) {
          return { module: "guildTamper", describeTarget: `Đổi cấu hình server (${tampered.join(", ")})` };
        }
        return null;
      }
      default:
        return null;
    }
  }

  function attach() {
    client.on("guildBanAdd", async (ban) => {
      await handleAttributeEvent({
        guild: ban.guild,
        module: "massBan",
        eventType: AuditLogEvent.MemberBanAdd,
        targetId: ban.user?.id,
        describeTarget: `<@${ban.user?.id}>`,
      }).catch((e) => console.error("[antinuke:ban]", e.message));
    });

    client.on("guildMemberRemove", async (member) => {
      // Only treat as a kick when the audit log shows a kick for this member.
      const executor = await auditExecutor(member.guild, AuditLogEvent.MemberKick, member.id).catch(() => null);
      if (executor) {
        await handleAttributeEvent({
          guild: member.guild,
          module: "massKick",
          eventType: AuditLogEvent.MemberKick,
          targetId: member.id,
          describeTarget: `<@${member.id}>`,
        }).catch((e) => console.error("[antinuke:kick]", e.message));
        return; // bị mod/bot khác kick — không phải tự rời
      }
      // Không có audit kick → có thể bot tự rời: kiểm hit-and-run.
      await handleHitAndRunLeave(member, null).catch((e) => console.error("[antinuke:hitAndRun]", e.message));
    });

    client.on("channelCreate", (channel) => {
      void handleAttributeEvent({
        guild: channel.guild,
        module: "massChannelCreate",
        eventType: AuditLogEvent.ChannelCreate,
        targetId: channel.id,
        describeTarget: `#${channel.name}`,
      }).catch((e) => console.error("[antinuke:channelCreate]", e.message));
    });

    client.on("channelDelete", (channel) => {
      void handleAttributeEvent({
        guild: channel.guild,
        module: "massChannelDelete",
        eventType: AuditLogEvent.ChannelDelete,
        targetId: channel.id,
        describeTarget: `#${channel.name}`,
      }).catch((e) => console.error("[antinuke:channelDelete]", e.message));
    });

    client.on("roleCreate", (role) => {
      void handleAttributeEvent({
        guild: role.guild,
        module: "massRoleCreate",
        eventType: AuditLogEvent.RoleCreate,
        targetId: role.id,
        describeTarget: `<@&${role.id}>`,
      }).catch((e) => console.error("[antinuke:roleCreate]", e.message));
    });

    client.on("roleDelete", (role) => {
      void handleAttributeEvent({
        guild: role.guild,
        module: "massRoleDelete",
        eventType: AuditLogEvent.RoleDelete,
        targetId: role.id,
        describeTarget: role.name,
      }).catch((e) => console.error("[antinuke:roleDelete]", e.message));
    });

    client.on("messageDeleteBulk", (messages) => {
      void handleMessageBulk(messages).catch((e) => console.error("[antinuke:bulk]", e.message));
    });

    client.on("guildMemberAdd", (member) => {
      void handleRaidJoin(member).catch((e) => console.error("[antinuke:join]", e.message));
      // Bot mới được thêm: ghi thời điểm cho module botHitAndRun (vào-rồi-rời).
      try {
        if ((member.user?.bot ?? member.bot) === true) {
          botAddTimes.set(`${member.guild.id}:${member.id}`, Date.now());
        }
      } catch {}
      // Cảnh báo bot lạ (suspiciousBotAlert) — chỉ cảnh báo, không phạt.
      void handleSuspiciousBotJoin(member).catch((e) => console.error("[antinuke:botAlert]", e.message));
    });

    client.on("messageCreate", (message) => {
      void handleSpam(message).catch((e) => console.error("[antinuke:spam]", e.message));
      void handleMessagePatterns(message).catch((e) => console.error("[antinuke:pattern]", e.message));
    });

    // Sự kiện audit log mới (discord.js >= 14.10) — định tuyến tất cả biến thể
    // nuke/raid: webhook/thread create+delete, sửa/đổi quyền kênh, sửa role,
    // tự cấp quyền quản trị, gán role/nickname hàng loạt, emoji/sticker, bot add,
    // invite create, đổi cấu hình server.
    if (typeof client.on === "function" && AuditLogEvent.WebhookCreate !== undefined) {
      client.on("guildAuditLogEntryCreate", (entry, guild) => {
        void (async () => {
          // Raid bằng ứng dụng ngoài (external app): xử lý riêng có AI nhận diện.
          if (entry.action === AuditLogEvent.IntegrationCreate) {
            await handleExternalApp(entry, guild);
            return;
          }
          const routed = await routeAuditEntry(entry, guild);
          if (!routed) return;
          await handleAuditEntry(entry, guild, routed.module, routed.describeTarget);
        })().catch((e) => console.error("[antinuke:auditEntry]", e.message));
      });
    }

    setInterval(() => {
      void tickUnlocks().catch((e) => console.error("[antinuke:tick]", e.message));
      void tickHeatResets().catch((e) => console.error("[heat:resetTick]", e.message));
      sweepMemory();
    }, 20_000);
  }

  return { attach, sweepMemory };
};

module.exports.MODULE_LABELS = MODULE_LABELS;
module.exports.messageFingerprint = messageFingerprint;
module.exports.isExternalAppSpam = isExternalAppSpam;
module.exports.joinClusterSuspicion = joinClusterSuspicion;
module.exports.memberSuspicionScore = memberSuspicionScore;
module.exports.isExempt = isExempt;
module.exports.isTrustedBotMember = isTrustedBotMember;
module.exports.isKnownLoggingBot = isKnownLoggingBot;
module.exports.botHitAndRunVerdict = botHitAndRunVerdict;
module.exports.strangeBotVerdict = strangeBotVerdict;
