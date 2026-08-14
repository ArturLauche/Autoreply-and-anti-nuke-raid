const { AuditLogEvent, PermissionFlagsBits, Colors } = require("discord.js");
const { logEmbed, sendLog } = require("../util");
const { sendCaseLog } = require("../caseLog");
const { isLocked, markLocked, lockGuild, unlockGuild } = require("../lockdown");
const {
  heatSettings,
  punishMember,
  choosePunish,
  heatSummary,
} = require("../heat");
const { actionsOf, memberPunishOf, cleanupMessages } = require("../moduleActions");
const {
  messageFingerprint,
  isExternalAppSpam,
  appNameSuspicion,
  normalizeFuzzy,
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
  "externalAppRaid",
  "massInviteCreate",
  "guildTamper",
]);

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
  const lastConfigs = new Map(); // guildId -> config (đã đọc gần nhất)

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

  /** Số thành viên mới vào server trong cửa sổ (đo làn sóng raid đang diễn ra). */
  function recentJoinCount(guildId, windowMs) {
    const arr = joiners.get(guildId) ?? [];
    const cutoff = Date.now() - windowMs;
    return arr.filter((j) => j.ts >= cutoff).length;
  }

  function isExempt(member, moduleCfg, guildConfig) {
    if (!member) return false;
    if (member.id === member.guild.ownerId) return true;
    if (member.permissions.has(PermissionFlagsBits.Administrator)) return true;
    if ((guildConfig?.adminRoles || []).some((id) => member.roles.cache.has(id))) return true;
    if ((guildConfig?.modRoles || []).some((id) => member.roles.cache.has(id))) return true;
    // Whitelist toàn cục: role/người dùng được miễn trừ khỏi mọi module nuke/raid/moderation.
    if ((guildConfig?.whitelistRoles || []).some((id) => member.roles.cache.has(id))) return true;
    if ((guildConfig?.whitelistUsers || []).includes(member.id)) return true;
    if ((moduleCfg?.whitelistRoles || []).some((id) => member.roles.cache.has(id))) return true;
    return false;
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
    for (const [guildId] of lastConfigs) {
      if (!live.has(guildId)) lastConfigs.delete(guildId);
    }
    if (buckets.size > BUCKET_MAX) {
      // Giữ lại 200 key gần nhất (chống phình vô hạn)
      const keys = [...buckets.keys()].slice(0, buckets.size - BUCKET_MAX);
      for (const k of keys) buckets.delete(k);
    }
  }

  /** Gọi AI phân loại sự kiện raid vs cá nhân. Trả về null khi AI không có. */
  async function aiClassify(guild, module, count, windowSeconds, threshold, samples) {
    try {
      const recentJoins = joiners.get(guild.id)?.length ?? 0;
      const res = await Promise.race([
        store.client.action("haimiya:classifyViolation", {
          guildId: guild.id,
          guildName: guild.name,
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

  /** Gọi AI phân tích cụm raid (best-effort, 6s timeout). Trả null khi AI offline. */
  async function aiAnalyzeRaid(guild, module, count, windowSeconds, threshold, clusterProfile, recentActions) {
    try {
      const res = await Promise.race([
        store.client.action("haimiya:analyzeRaid", {
          guildId: guild.id,
          guildName: guild.name,
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

  /** Gọi AI xác định chuỗi kết nối external app có phải raid không (best-effort, 6s timeout). */
  async function aiAnalyzeExternalApp(guild, count, windowSeconds, threshold, appProfile, recentJoins) {
    try {
      const res = await Promise.race([
        store.client.action("haimiya:analyzeExternalApp", {
          guildId: guild.id,
          guildName: guild.name,
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
  async function punishWithHeat(guild, member, moduleCfg, reason) {
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
    if (NUKE_MODULES.has(moduleCfg.module)) {
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
    // AI khẳng định raid (confidence >= 0.6) HOẶC AI offline mà nghi vấn rất cao → raid.
    const aiOffline = !ai || ai.offline === true;
    const isRaid =
      (ai?.isRaid === true && (ai?.confidence ?? 0) >= 0.6) || (aiOffline && suspectScore >= 6);
    const reason = `[Protogon AntiNuke] ${MODULE_LABELS.externalAppRaid}: ${count} app được kết nối trong ${moduleCfg.windowSeconds}s (ngưỡng ${moduleCfg.threshold})${raidNote(ai, isRaid)}`;

    // Những người dùng đã kết nối app trong cửa sổ (bỏ trùng, giới hạn 5).
    const targets = [
      ...new Map(fresh.filter((e) => e.executorId).map((e) => [e.executorId, e])).values(),
    ].slice(0, 5);

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
    for (const t of targets) {
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
      executorId: targets[0]?.executorId ?? undefined,
      executorName: targets[0]?.executorName ?? undefined,
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
          ? targets.filter((t) => t.executorId).map((t) => ({ id: t.executorId, username: t.executorName }))
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
    await sendLog(guild, config, embed);
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

    const hay = `${message.content || ""} ${(message.embeds || []).map((e) => e.title || e.description || "").join(" ")}`;
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
    const signalLine =
      `Tín hiệu nội dung: lặp giống hệt=${sameFingerprint}, lặp gần giống=${similar}, ` +
      `@everyone/@here=${hasEveryone ? "có" : "không"}, link mời Discord=${hasInvite ? "có" : "không"}, ` +
      `link rút gọn=${hasShortlink ? "có" : "không"}, từ khóa scam=${scamHits}, số URL=${urlCount}`;
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
    // 2) Nếu app là BOT user trong server → phạt theo cấu hình (kick mặc định; AI raid → ban).
    const member = isBot ? await message.guild.members.fetch(message.author.id).catch(() => null) : null;
    if (member && !isExempt(member, moduleCfg, config)) {
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
          if (cm && !isExempt(cm, moduleCfg, config)) {
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
    await sendLog(message.guild, config, embed);
  }

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

    const count = record(guild.id, module, moduleCfg);
    if (executor && count < moduleCfg.threshold) return;
    if (!executor) return; // can't attribute, can't punish — stay quiet

    let action = "đã ghi nhận";
    const actions = actionsOf(moduleCfg);
    try {
      const member = await guild.members.fetch(executor.id).catch(() => null);
      const reason = `[Protogon AntiNuke] ${MODULE_LABELS[module]}: ${count} lượt trong ${moduleCfg.windowSeconds}s (ngưỡng ${moduleCfg.threshold})`;
      if (member) {
        const res = await punishWithHeat(guild, member, moduleCfg, reason);
        action = res.action;
      } else if (actions.includes("ban")) {
        try {
          await guild.members.ban(executor.id, { reason });
          action = "đã ban";
        } catch {
          action = "không thể ban";
        }
      }
      await maybeLockdown(guild, config);
      // purgeMessages: xóa hàng loạt tin nhắn của thủ phạm trên toàn guild (giới hạn).
      if (actions.includes("purgeMessages")) {
        const cleanup = await cleanupMessages({
          guild,
          channel: null,
          userId: executor.id,
          actions: ["purgeMessages"],
          triggerMessage: null,
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

    const reason = `[Protogon AntiNuke] Raid thành viên: ${fresh.length} người tham gia trong ${moduleCfg.windowSeconds}s`;
    const results = [];
    const profiles = []; // hồ sơ cụm tài khoản raid → Raid Intel
    const actions = actionsOf(moduleCfg);
    // purgeMessages: giới hạn chỉ purge vài tài khoản mới nhất để tránh quá tải.
    let purgedCount = 0;
    const purgeLimit = actions.includes("purgeMessages") ? 3 : 0;
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
          ? `xử lý ${results.length} tài khoản (${moduleCfg.punish})${purgedCount > 0 ? ` · purge ${purgedCount} tài khoản` : ""}`
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
    // External App Guard (tầng tin nhắn): tin từ bot lạ / webhook / app command
    // không lọt vào các module spam dành cho người dùng → xử lý riêng.
    if (message.author?.bot || message.webhookId || message.applicationId) {
      await handleExternalAppMessage(message);
      return;
    }
    if (message.author.bot) return;
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
    if (message.author.bot) return;
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
            markLocked(guild.id);
            await unlockGuild(client, guild, config, store);
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
            exempt =
              em.id === guild.ownerId ||
              em.permissions.has(PermissionFlagsBits.Administrator) ||
              (config?.adminRoles || []).some((id) => em.roles.cache.has(id));
          } else {
            exempt = isExempt(em, moduleCfg, config);
          }
        }
      }
    }
    if (exempt) return;

    const count = record(guild.id, module, moduleCfg);
    if (executor && count < moduleCfg.threshold) return;
    if (!executor) return;

    let action = "đã ghi nhận";
    const actions = actionsOf(moduleCfg);
    try {
      const member = await guild.members.fetch(executor.id).catch(() => null);
      const reason = `[Protogon AntiNuke] ${MODULE_LABELS[module]}: ${count} lượt trong ${moduleCfg.windowSeconds}s (ngưỡng ${moduleCfg.threshold})`;
      if (member) {
        const res = await punishWithHeat(guild, member, moduleCfg, reason);
        action = res.action;
      } else if (actions.includes("ban")) {
        try {
          await guild.members.ban(executor.id, { reason });
          action = "đã ban";
        } catch {
          action = "không thể ban";
        }
      }
      await maybeLockdown(guild, config);
      // purgeMessages: xóa hàng loạt tin nhắn của thủ phạm trên toàn guild (giới hạn).
      if (actions.includes("purgeMessages")) {
        const cleanup = await cleanupMessages({
          guild,
          channel: null,
          userId: executor.id,
          actions: ["purgeMessages"],
          triggerMessage: null,
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
      if (!executor) return;
      await handleAttributeEvent({
        guild: member.guild,
        module: "massKick",
        eventType: AuditLogEvent.MemberKick,
        targetId: member.id,
        describeTarget: `<@${member.id}>`,
      }).catch((e) => console.error("[antinuke:kick]", e.message));
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
