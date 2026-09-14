"use strict";
/**
 Raid Intel — săn lùng nguồn cơn raid + ghi mẫu dữ liệu huấn luyện lên Convex. 
 */
const { AuditLogEvent } = require("discord.js");
const {
  MODULE_LABELS,
  KNOWN_LOGGING_BOTS,
  isKnownLoggingBot,
  NUKE_MODULES,
  IMMEDIATE_BOT_NUKE,
  strangeBotVerdict,
  botHitAndRunVerdict,
  isTrustedBotMember,
  isExempt,
  moduleCfgOf,
  memberSuspicionScore,
  joinClusterSuspicion,
  messageFingerprint,
  isExternalAppSpam,
  LONG_MSG_LEN,
  ZERO_WIDTH_RE,
} = require("./shared");

module.exports = function createAntiNukeLayer({ client, store, heat, state, core, ai, raidIntel, externalApp }) {
  const { aiAnalyzeRaid } = ai ?? {};

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

  return { huntRaidSource, recordRaidSample };
};
