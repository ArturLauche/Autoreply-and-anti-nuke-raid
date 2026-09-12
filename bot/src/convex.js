const { ConvexHttpClient } = require("convex/browser");

// TTL mặc định 300s (tăng từ 180s): cấu hình hiếm khi đổi — giảm số query
// getConfig thêm ~40% so với TTL 180s và ~10 lần so với TTL 30s ban đầu.
// Riêng guild có "cờ chờ xử lý" (lockdownRequested, heatResetRequested, DM chờ,
// verify panel) dùng TTL ngắn 30s để nút bấm trên dashboard có tác dụng nhanh.
// Ngoài ra getConfig(guildId, { force: true }) luôn đọc mới — dùng cho các chỗ
// cần kết quả tức thì (mở khóa kênh, xóa nhiệt, gửi panel, backup ngay).
const CONFIG_TTL_MS = 300_000;
const CONFIG_TTL_PENDING_MS = 30_000;
const MAX_RETRIES = 3;
const BASE_RETRY_DELAY_MS = 500;

/**
 * Wraps a Convex HTTP call with retry + exponential backoff.
 * Transient network errors and 5xx are retried; 4xx (except 429) fail immediately.
 */
async function withRetry(fn, label) {
  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    try {
      return await fn();
    } catch (err) {
      const status = err?.statusCode ?? err?.status;
      const isRetryable =
        !status || status >= 500 || status === 429 || err?.code === "ECONNRESET" || err?.code === "ETIMEDOUT";
      if (attempt === MAX_RETRIES || !isRetryable) {
        console.error(`[convex:${label}] attempt ${attempt}/${MAX_RETRIES} failed:`, err?.message || err);
        throw err;
      }
      const delay = BASE_RETRY_DELAY_MS * Math.pow(2, attempt - 1) + Math.random() * 200;
      console.warn(`[convex:${label}] attempt ${attempt} failed, retrying in ${Math.round(delay)}ms...`);
      await new Promise((r) => setTimeout(r, delay));
    }
  }
}

class ConvexStore {
  constructor() {
    const url = process.env.CONVEX_URL;
    if (!url) {
      throw new Error(
        "❌ CONVEX_URL không được để trống. " +
        "Kiểm tra file .env ở thư mục bot hoặc biến môi trường trên VPS."
      );
    }
    this.client = new ConvexHttpClient(url);
    if (process.env.CONVEX_DEPLOY_KEY) {
      this.client.setAdminAuth(process.env.CONVEX_DEPLOY_KEY);
    }
    this.cache = new Map(); // guildId -> { config, fetchedAt }
    this.ruleCooldowns = new Map(); // `${guildId}:${ruleId}` -> timestamp
    this._startedAt = Date.now();
    this._lastHeartbeat = 0;
    this._heartbeatOk = false;
  }

  /**
   * Fetch the config bundle for a guild, with TTL cache + retry.
   * opts.force: luôn đọc mới (bỏ qua cache) — cho các thao tác cần tức thì.
   * Guild có cờ chờ xử lý được tự động cache ngắn (30s).
   */
  async getConfig(guildId, opts = {}) {
    const hit = this.cache.get(guildId);
    if (!opts.force && hit) {
      const now = Date.now();
      const hasPending =
        hit.config?.lockdownRequested ||
        hit.config?.heatResetRequested ||
        hit.config?.dmRequested ||
        hit.config?.verifySendPanel ||
        // Đang trong cửa sổ khóa kênh: cần thấy cờ "Mở khóa" từ dashboard nhanh.
        (typeof hit.config?.lockdownUntil === "number" && hit.config.lockdownUntil > now);
      const ttl = hasPending ? CONFIG_TTL_PENDING_MS : CONFIG_TTL_MS;
      if (now - hit.fetchedAt < ttl) return hit.config;
    }
    try {
      const config = await withRetry(
        () => this.client.query("guilds:getBotConfig", { guildId }),
        `getConfig:${guildId}`
      );
      this.cache.set(guildId, { config, fetchedAt: Date.now() });
      return config;
    } catch (err) {
      console.error(`[convex] getConfig(${guildId}) failed after retries:`, err?.message);
      // Return cached version if available (even if stale)
      if (hit) return hit.config;
      throw err;
    }
  }

  /** Invalidate the cache after the bot itself writes config. */
  invalidate(guildId) {
    this.cache.delete(guildId);
  }

  /** Send health check heartbeat to Convex. */
  async sendHeartbeat(guildCount, memberCount) {
    try {
      await withRetry(() =>
        this.client.mutation("status:heartbeat", {
          online: true,
          guildCount,
          memberCount,
          version: "3.0.0",
        }),
        "heartbeat"
      );
      this._lastHeartbeat = Date.now();
      this._heartbeatOk = true;
    } catch (err) {
      this._heartbeatOk = false;
      console.error("[health] heartbeat failed:", err?.message);
    }
  }

  /** Check the per-rule cooldown; returns true when the bot must stay quiet. */
  isCooledDown(guildId, ruleId, cooldownSeconds) {
    if (!cooldownSeconds) return false;
    const hit = this.ruleCooldowns.get(`${guildId}:${ruleId}`);
    return !!hit && Date.now() - hit < cooldownSeconds * 1000;
  }

  recordReply(guildId, ruleId) {
    this.ruleCooldowns.set(`${guildId}:${ruleId}`, Date.now());
    if (this.ruleCooldowns.size > 500) {
      const now = Date.now();
      for (const [k, v] of this.ruleCooldowns) {
        if (now - v > 86_400_000) this.ruleCooldowns.delete(k);
      }
    }
  }

  /** Simple mutation wrapper with retry. */
  async mutation(name, args) {
    return withRetry(() => this.client.mutation(name, args), `mutation:${name}`);
  }

  /** Simple query wrapper with retry. */
  async query(name, args) {
    return withRetry(() => this.client.query(name, args), `query:${name}`);
  }
}

module.exports = ConvexStore;
