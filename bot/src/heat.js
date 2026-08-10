/**
 * Hệ thống nhiệt độ vi phạm (Heat system).
 *
 * Mỗi vi phạm cộng "nhiệt" theo cài đặt của module. Nhiệt tự giảm theo thời gian
 * (decay) và chia 4 giai đoạn hình phạt: cảnh báo (warnAt) → tạm khóa (timeoutAt)
 * → kick (kickAt) → ban (banAt).
 *
 * Chống tái phạm: nếu thành viên vừa bị phạt (warn/timeout/kick/ban) mà tái phạm
 * trong cửa sổ heatRepeatWindowMin, điểm nhiệt lần sau được nhân với
 * heatRepeatMultiplier → đầy thanh nhanh hơn.
 *
 * Warn tích lũy (moderation): khi hình phạt là "warn", mỗi lần vi phạm đếm 1
 * strike; đủ warnStrikeLimit lần trong cửa sổ → tự tăng cấp thành warnStrikePunish.
 */
const TIER_STRENGTH = { warn: 1, timeout: 2, kick: 3, ban: 4 };
const HEAT_MAX = 100;
const MIN_MS = 60_000;

/** Lấy cài đặt nhiệt độ + warn strike của guild (kèm giá trị mặc định). */
function heatSettings(config) {
  return {
    enabled: config?.heatEnabled !== false,
    decayPerMin: Math.max(0, config?.heatDecayPerMin ?? 3),
    warnAt: config?.heatWarnAt ?? 25,
    timeoutAt: config?.heatTimeoutAt ?? 40,
    kickAt: config?.heatKickAt ?? 70,
    banAt: config?.heatBanAt ?? 90,
    repeatMultiplier: Math.max(1, Math.min(10, config?.heatRepeatMultiplier ?? 2)),
    repeatWindowMin: Math.max(1, Math.min(1440, config?.heatRepeatWindowMin ?? 30)),
    warnStrikeLimit: Math.max(0, Math.min(20, config?.warnStrikeLimit ?? 3)),
    warnStrikeWindowMin: Math.max(1, Math.min(1440, config?.warnStrikeWindowMin ?? 60)),
    warnStrikePunish: config?.warnStrikePunish ?? "timeout",
  };
}

/** Bậc nhiệt hiện tại dựa trên các ngưỡng. */
function tierFor(heat, s) {
  if (heat >= s.banAt) return "ban";
  if (heat >= s.kickAt) return "kick";
  if (heat >= s.timeoutAt) return "timeout";
  if (heat >= s.warnAt) return "warn";
  return "safe";
}

/** Thực thi một hình phạt đơn. Trả về mô tả hành động đã làm. */
async function punishMember(guild, member, punishType, reason, timeoutSeconds = 300) {
  if (punishType === "timeout") {
    const seconds = Math.max(1, Math.min(86400, Math.floor(timeoutSeconds || 300)));
    try {
      await member.timeout(seconds * 1000, reason);
      return `đã tạm khóa ${Math.round(seconds / 60)} phút`;
    } catch {
      return "không thể tạm khóa (thiếu quyền)";
    }
  }
  if (punishType === "warn") {
    try {
      await member.send(
        `⚠️ **Cảnh báo từ Protogon**\n${reason}\n\nĐây là cảnh báo tự động từ hệ thống bảo vệ. Vui lòng dừng hành vi này.`,
      );
      return "đã cảnh báo qua DM";
    } catch {
      return "đã cố cảnh báo (DM đóng)";
    }
  }
  try {
    if (punishType === "kick") {
      await member.kick(reason);
      return "đã kick";
    }
    await member.ban({ reason, deleteMessageSeconds: 0 });
    return "đã ban";
  } catch {
    return "không thể xử lý (thiếu quyền)";
  }
}

/**
 * Quyết định hình phạt cuối cùng: nếu nhiệt độ đủ cao để tăng cấp
 * (mạnh hơn hình phạt mặc định của module) thì dùng bậc nhiệt.
 */
function choosePunish(basePunish, heatResult) {
  if (!heatResult) return basePunish;
  if (TIER_STRENGTH[heatResult.tier] > TIER_STRENGTH[basePunish]) return heatResult.tier;
  return basePunish;
}

/** Chuỗi tóm tắt nhiệt độ để thêm vào log (vd: " · +10 nhiệt → 40/100"). */
function heatSummary(heatResult) {
  if (!heatResult) return "";
  const extra = [];
  if (heatResult.repeated) extra.push(`tái phạm x${heatResult.multiplier}`);
  if (heatResult.warned) extra.push("⚠️ đã DM cảnh báo");
  const tag = extra.length > 0 ? ` (${extra.join(", ")})` : "";
  return ` · +${heatResult.added} nhiệt → ${Math.round(heatResult.heat)}/${HEAT_MAX}${tag}`;
}

class HeatTracker {
  constructor(client, store) {
    this.client = client;
    this.store = store;
    this.states = new Map(); // `${guildId}:${userId}` -> { heat, updatedAt, lastPunishedAt }
    this.warned = new Set(); // đã gửi cảnh báo DM cho ngưỡng này
    this.strikes = new Map(); // `${guildId}:${userId}` -> { count, firstAt } (warn tích lũy)
    this.pending = new Map(); // guildId -> Map<key, username> chờ đồng bộ
    this.timers = new Map(); // guildId -> setTimeout id
  }

  _key(guildId, userId) {
    return `${guildId}:${userId}`;
  }

  _decay(entry, s) {
    const elapsedMin = (Date.now() - entry.updatedAt) / MIN_MS;
    return Math.max(0, Math.round(entry.heat - elapsedMin * s.decayPerMin));
  }

  /** Nhiệt độ hiệu dụng (đã trừ decay) của một thành viên. */
  getHeat(guildId, userId, s) {
    const key = this._key(guildId, userId);
    const entry = this.states.get(key);
    if (!entry) return 0;
    const heat = this._decay(entry, s);
    if (heat <= 0) {
      this.states.delete(key);
      this.warned.delete(key);
    } else if (heat < s.warnAt) {
      this.warned.delete(key); // nguội xuống dưới ngưỡng → có thể cảnh báo lại lần sau
    }
    return heat;
  }

  /** Gửi cảnh báo DM khi thành viên chạm ngưỡng warnAt (mỗi chu kỳ 1 lần). */
  async _maybeWarn(guildId, userId, heat, s) {
    const key = this._key(guildId, userId);
    if (heat < s.warnAt || this.warned.has(key)) return false;
    this.warned.add(key);
    try {
      const guild = this.client.guilds.cache.get(guildId);
      const member = guild ? await guild.members.fetch(userId).catch(() => null) : null;
      if (!member) return true;
      await member.send(
        `🔥 **Cảnh báo nhiệt độ từ Protogon**\n\n` +
          `Bạn vừa đạt **${heat}/${HEAT_MAX}** điểm nhiệt vi phạm tại **${guild.name}**.\\n` +
          `Tiếp tục vi phạm sẽ bị:\\n` +
          `• Tạm khóa khi chạm **${s.timeoutAt}**\\n` +
          `• Kick khi chạm **${s.kickAt}**\\n` +
          `• Ban khi chạm **${s.banAt}**\\n\\n` +
          `Nhiệt độ tự giảm ${s.decayPerMin} điểm mỗi phút. Hãy dừng hành vi vi phạm!`,
      );
      return true;
    } catch {
      return true; // DM đóng — vẫn tính là đã cảnh báo để không spam lại
    }
  }

  /**
   * Cộng nhiệt cho một vi phạm. Nếu đang trong cửa sổ tái phạm (vừa bị phạt),
   * điểm nhiệt được nhân với heatRepeatMultiplier.
   */
  async add(guildId, userId, username, points, s) {
    if (!s.enabled || points <= 0) return null;
    const key = this._key(guildId, userId);
    const prev = this.getHeat(guildId, userId, s);
    let repeated = false;
    const entry = this.states.get(key);
    if (entry?.lastPunishedAt) {
      const minutesSince = (Date.now() - entry.lastPunishedAt) / MIN_MS;
      if (minutesSince < s.repeatWindowMin) {
        points *= s.repeatMultiplier;
        repeated = true;
      }
    }
    const heat = Math.min(HEAT_MAX, prev + Math.round(points));
    this.states.set(key, {
      heat,
      updatedAt: Date.now(),
      lastPunishedAt: entry?.lastPunishedAt,
    });
    const warned = await this._maybeWarn(guildId, userId, heat, s);
    this._scheduleFlush(guildId, key, username);
    return { heat, tier: tierFor(heat, s), added: heat - prev, warned, repeated, multiplier: s.repeatMultiplier };
  }

  /** Ghi nhận thời điểm bị phạt (để lần tái phạm sau nhân nhiệt). */
  markPunished(guildId, userId) {
    const key = this._key(guildId, userId);
    const entry = this.states.get(key);
    this.states.set(key, {
      heat: entry?.heat ?? 0,
      updatedAt: entry?.updatedAt ?? Date.now(),
      lastPunishedAt: Date.now(),
    });
  }

  /**
   * Đếm warn tích lũy. Trả về { escalated, punish, count }:
   *  - punish === "warn" + escalated=false: chưa đủ ngưỡng, chỉ cảnh báo.
   *  - escalated=true: đủ warnStrikeLimit lần → tăng cấp warnStrikePunish (và reset đếm).
   *  - limit <= 0: tắt tính năng, luôn trả warn.
   */
  strike(guildId, userId, s) {
    const key = this._key(guildId, userId);
    if (!s.warnStrikeLimit) return { escalated: false, punish: "warn", count: 0 };
    const now = Date.now();
    const hit = this.strikes.get(key);
    let count = 0;
    if (hit && now - hit.firstAt < s.warnStrikeWindowMin * MIN_MS) {
      count = hit.count;
    }
    count += 1;
    if (count >= s.warnStrikeLimit) {
      this.strikes.delete(key);
      return { escalated: true, punish: s.warnStrikePunish, count };
    }
    this.strikes.set(key, { count, firstAt: now });
    return { escalated: false, punish: "warn", count };
  }

  /** Số strike hiện tại của một thành viên (cho /heat status). */
  strikeCount(guildId, userId, s) {
    const hit = this.strikes.get(this._key(guildId, userId));
    if (!hit || Date.now() - hit.firstAt >= s.warnStrikeWindowMin * MIN_MS) return 0;
    return hit.count;
  }

  /** Xóa nhiệt trong bộ nhớ (khi dashboard yêu cầu reset). */
  resetGuild(guildId, userId) {
    const prefix = `${guildId}:`;
    const exact = userId ? `${guildId}:${userId}` : null;
    for (const key of [...this.states.keys()]) {
      if (!key.startsWith(prefix)) continue;
      if (exact && key !== exact) continue;
      this.states.delete(key);
      this.warned.delete(key);
      this.strikes.delete(key);
      this.pending.get(guildId)?.delete(key);
    }
  }

  /** Gộp các lần cộng nhiệt của một guild để ghi lên Convex (4 giây/lần). */
  _scheduleFlush(guildId, key, username) {
    if (!this.pending.has(guildId)) this.pending.set(guildId, new Map());
    this.pending.get(guildId).set(key, username);
    if (this.timers.has(guildId)) return;
    this.timers.set(
      guildId,
      setTimeout(() => {
        this.timers.delete(guildId);
        void this.flushGuild(guildId);
      }, 4000),
    );
  }

  async flushGuild(guildId) {
    const dirty = this.pending.get(guildId);
    this.pending.delete(guildId);
    if (!dirty) return;
    for (const [key, username] of dirty) {
      const entry = this.states.get(key);
      if (!entry) continue;
      const [, userId] = key.split(":");
      try {
        await this.store.client.mutation("bot_writes:botRecordHeat", {
          guildId,
          userId,
          username: username || undefined,
          heat: entry.heat,
          updatedAt: entry.updatedAt,
        });
      } catch (e) {
        console.error("[heat:flush]", e.message);
      }
    }
  }

  /** Ghi tất cả nhiệt còn chờ (chạy định kỳ). */
  async flushAll() {
    for (const guildId of [...this.pending.keys()]) {
      await this.flushGuild(guildId);
    }
  }
}

module.exports = {
  HeatTracker,
  heatSettings,
  tierFor,
  TIER_STRENGTH,
  HEAT_MAX,
  punishMember,
  choosePunish,
  heatSummary,
};
