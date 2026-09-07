const { ConvexHttpClient } = require("convex/browser");

const CONFIG_TTL_MS = 30_000;

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
      // Allows the bot to call mutations on a production deployment.
      this.client.setAdminAuth(process.env.CONVEX_DEPLOY_KEY);
    }
    this.cache = new Map(); // guildId -> { config, fetchedAt }
    this.ruleCooldowns = new Map(); // `${guildId}:${ruleId}` -> timestamp
  }

  /** Fetch the config bundle for a guild, with a short TTL cache. */
  async getConfig(guildId) {
    const hit = this.cache.get(guildId);
    if (hit && Date.now() - hit.fetchedAt < CONFIG_TTL_MS) return hit.config;
    const config = await this.client.query("guilds:getBotConfig", { guildId });
    this.cache.set(guildId, { config, fetchedAt: Date.now() });
    return config;
  }

  /** Invalidate the cache after the bot itself writes config. */
  invalidate(guildId) {
    this.cache.delete(guildId);
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
}

module.exports = ConvexStore;
