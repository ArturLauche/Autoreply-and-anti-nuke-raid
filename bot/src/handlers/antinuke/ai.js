"use strict";
/**
 Lớp gọi AI phân loại raid/vi phạm (best-effort, 6s timeout) — trả null khi AI offline. 
 */
const aiClient = require("../../ai");

module.exports = function createAntiNukeLayer({ state }) {
  const { joiners } = state.state;

  /** Gọi AI phân loại sự kiện raid vs cá nhân. Trả về null khi AI không có.
   *  Chạy TRỰC TIẾP từ process bot (bot/src/ai.js) — không tốn Convex actions.
   *  opts.knownThreats (tùy chọn): { keywords, phrases } — mẫu scam mạng đã xác
   *  nhận để AI đối chiếu (bot tự học từ các vụ raid thật, 0 token).
   */
  async function aiClassify(guild, module, count, windowSeconds, threshold, samples, opts = {}) {
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
          knownThreats: opts?.knownThreats ?? undefined,
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
  async function aiAnalyzeRaid(
    guild,
    module,
    count,
    windowSeconds,
    threshold,
    clusterProfile,
    recentActions,
  ) {
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
  async function aiAnalyzeExternalApp(
    guild,
    count,
    windowSeconds,
    threshold,
    appProfile,
    recentJoins,
  ) {
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
      clusterAvgAccountAgeDays: ages.length
        ? Math.round(ages.reduce((a, b) => a + b, 0) / ages.length)
        : undefined,
      clusterSharedAvatarCount: shared,
      clusterJoinBurstSeconds: Math.round(burst),
    };
  }

  return { aiClassify, aiAnalyzeRaid, aiAnalyzeExternalApp, raidNote, clusterStats };
};
