// ============================================================
// Protogon Bot — Full-Featured Production Entry Point
// Target: VPS with 32GB RAM, 6 CPU cores, 80GB storage
// ============================================================

require("./loadenv").loadEnv();

// --- Startup env validation ---
const REQUIRED_VARS = ["DISCORD_TOKEN"];
const MISSING = REQUIRED_VARS.filter((k) => !process.env[k]);
if (MISSING.length > 0) {
  console.error(`❌ Thiếu biến môi trường bắt buộc: ${MISSING.join(", ")}`);
  console.error("   Kiểm tra file .env hoặc biến môi trường trên VPS.");
  process.exit(1);
}
if (!process.env.CONVEX_URL) {
  console.error("❌ Thiếu CONVEX_URL — bot cần kết nối Convex backend.");
  console.error("   Thêm CONVEX_URL=https://xxx-xxx-xx.convex.cloud vào file .env");
  process.exit(1);
}

const {
  Client,
  GatewayIntentBits,
  ActivityType,
  Collection,
  Partials,
} = require("discord.js");
const ConvexStore = require("./convex");
const { HeatTracker } = require("./heat");
const guildSync = require("./handlers/guildSync");
const onMessageCreate = require("./handlers/messageCreate");
const onInteractionCreate = require("./handlers/interactionCreate");
const joinGate = require("./handlers/joinGate");
const { scanGuildForAlts } = require("./altDetection");
const webhookHub = require("./webhookHub");

// --- Client config: full-featured for powerful VPS ---
const client = new Client({
  partials: [
    Partials.Message,
    Partials.Channel,
    Partials.Reaction,
    Partials.User,
    Partials.GuildMember,
  ],
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.GuildMessageReactions,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.GuildModeration,
  ],
  makeCache: (manager) => {
    // Use default Collection for all managers (full caching)
    return new Collection();
  },
  sweepers: {
    messages: { interval: 3600, lifetime: 1800 }, // 1 hour interval, 30 min lifetime
    users: { interval: 3600, filter: () => (user) => user.id !== client.user?.id },
    guildMembers: { interval: 3600, filter: () => (member) => member.id !== member.guild?.ownerId },
  },
});

const store = new ConvexStore();
const heat = new HeatTracker(client, store);

client.once("clientReady", async () => {
  console.log(`✅ Protogon đã online: ${client.user.tag} — ${client.guilds.cache.size} server`);

  // Register slash commands
  if (process.env.AUTO_REGISTER_COMMANDS !== "false") {
    try {
      const { registerCommands } = require("./register-slash");
      const count = await registerCommands();
      console.log(`✅ Đã đăng ký ${count} slash commands`);
    } catch (err) {
      console.error("⚠️ Đăng ký slash commands thất bại:", err.message);
    }
  }

  // Init heavy modules
  const antinuke = require("./handlers/antinuke")(client, store, heat);
  const scanMessage = require("./handlers/filters");
  antinuke.attach();
  require("./timeoutWatch").attach(client, store);
  require("./handlers/hidden").setupHidden(client, store);
  webhookHub.init(client, store);

  // Bot owner detection
  try {
    const app = await client.application.fetch();
    const owner = app?.owner;
    const ownerId = owner?.ownerId || (/^\d{15,20}$/.test(owner?.id || "") ? owner.id : null);
    if (ownerId) {
      let ownerName, ownerAvatarUrl;
      try {
        const ownerUser = await client.users.fetch(ownerId).catch(() => null);
        if (ownerUser) {
          ownerName = ownerUser.username;
          ownerAvatarUrl = ownerUser.displayAvatarURL({ size: 256, extension: "png" });
        }
      } catch {}
      await store.client.mutation("hidden:botSetOwner", { ownerId, ownerName, ownerAvatarUrl });
    }
  } catch (e) {
    console.error("[owner]", e.message);
  }

  // Guild sync loop — mỗi 1 phút (đầy đủ)
  const runSyncLoop = () => {
    void (async () => {
      try {
        const res = await guildSync.syncAll(client, store);
        console.log(`[sync] ${res?.count ?? "?"} server${res?.trustedFullList === false ? " (cache thiếu)" : ""}`);
      } catch (e) {
        console.error("[sync]", e.message);
      }
      // TỐI ƯU USAGE: 120s (trước 60s) — guild MỚI/kick vẫn sync TỨC THÌ qua
      // sự kiện guildCreate/guildDelete (syncOne/markGone), vòng này chỉ nhịp
      // nền cho metadata; giảm 50% calls nhóm này (~43k→21.6k/tháng).
      setTimeout(runSyncLoop, 120_000);
    })();
  };
  setTimeout(() => {
    void (async () => {
      try { await guildSync.ensureModules(client, store); } catch (e) { console.error("[sync:ensure]", e.message); }
      runSyncLoop();
    })();
  }, 5_000);

  // Presence update — mỗi 60s (nhẹ: chỉ Discord cache, không gọi Convex)
  const presenceInterval = setInterval(() => {
    client.user.setPresence({
      activities: [{ name: `${client.guilds.cache.size} server · /help`, type: ActivityType.Watching }],
      status: "online",
    });
  }, 60_000);
  presenceInterval.unref();

  // Daily report — mỗi 15 phút (query per-guild chỉ khi đến hạn)
  const { runDailyReports } = require("./handlers/dailyReport");
  setTimeout(() => runDailyReports(client, store, heat).catch((e) => console.error("[report]", e.message)), 15_000);
  const reportInterval = setInterval(
    () => runDailyReports(client, store, heat).catch((e) => console.error("[report]", e.message)),
    15 * 60 * 1000,
  );
  reportInterval.unref();

  // Heat flush — mỗi 30s (batch 1 mutation/guild — rẻ mà heat cập nhật nhanh,
  // dashboard thấy "nhiệt độ" thành viên gần như realtime).
  const heatInterval = setInterval(
    () => heat.flushAll().catch((e) => console.error("[heat:flush]", e.message)),
    30_000,
  );
  heatInterval.unref();

  // Vòng quét TỔNG HỢP — mỗi 60s, 1 query batch (bot_tick:getPendingJobs) trả
  // { hidden, verifyPanels, backups } cho mọi guild: panel reaction role,
  // giveaway, DM chờ, webhook log mặc định, panel xác minh, backup/restore/import.
  // Thay 3 vòng quét riêng cũ (hidden 120s + verify 120s + backup 60s) — tiết kiệm
  // ~50% function calls nhóm này trên Convex free tier, hidden/verify nhanh hơn.
  require("./tick").setupTick(client, store);

  // Auto backup — mỗi 1 giờ (đặt cờ yêu cầu; việc backup thực hiện trong tick).
  const pollBackups = require("./handlers/backup");
  const autoBackupInterval = setInterval(
    () => pollBackups.autoBackupSweep(client, store).catch((e) => console.error("[backup:auto]", e.message)),
    1 * 60 * 60 * 1000,
  );
  autoBackupInterval.unref();

  // Threat Intel research — mỗi 4 giờ (6 lần/ngày), tải nguồn mở MIỄN PHÍ
  // (Reddit JSON API + CISA KEV) + AI tổng hợp tối đa 1 lần/tuần (~15k tokens/tháng).
  // Chỉ chạy khi chủ bot bật trên web Admin. Học từ khóa scam → dùng miễn phí vĩnh viễn.
  require("./research").setupResearch(client, store);

  // Threat Engine cục bộ — URLhaus feed (mỗi giờ), n-gram clustering (30 phút),
  // self-test regex, backfill raidSamples (1 lần). Toàn bộ chạy trên VPS: 0 token AI,
  // tận dụng CPU nhàn rỗi. URLhaus nạp vào filters chặn link malware mới.
  require("./threatEngine").setupThreatEngine(store);

  // Self-Diagnose — bắt unhandledRejection/uncaughtException toàn cục, gửi AI
  // (chuỗi research Kira/Mimo) chẩn đoán + đăng ĐỀ XUẤT vá vào kênh log. Chỉ
  // chạy khi owner bật trên Admin web (flag đi nhờ batch tick 60s sẵn có).
  // Flag cập nhật từng lượt tick qua setEnabledFromJobs (xem setupTick dưới).
  selfDiagnose.attach(client, store);

  // TỐI ƯU USAGE: KHÔNG còn vòng heartbeat 60s riêng (status:heartbeat) — nó
  // trùng 100% với guild sync loop 60s (đã gộp heartbeat vào botSyncGuilds qua
  // globalStatus). Vòng riêng cũ đốt ~43k function calls/tháng cho thông tin
  // y hệt. sendHeartbeat chỉ còn là FALLBACK khi sync loop lỗi liên tiếp.
  const heartbeatInterval = setInterval(() => {
    if (guildSync.isSyncHealthy()) return; // sync loop đang sống → không cần
    const memberCount = client.guilds.cache.reduce((a, g) => a + (g.memberCount ?? 0), 0);
    store.sendHeartbeat(client.guilds.cache.size, memberCount).catch(() => {});
  }, 5 * 60_000);
  heartbeatInterval.unref();

  // Memory monitoring — mỗi 30 phút (nhẹ nhàng)
  const memMonitorInterval = setInterval(() => {
    const mem = process.memoryUsage();
    const rss = Math.round(mem.rss / 1024 / 1024);
    const heap = Math.round(mem.heapUsed / 1024 / 1024);
    if (rss > 500) console.warn(`[mem] RSS=${rss}MB, Heap=${heap}MB — cao bất thường!`);
  }, 30 * 60 * 1000);
  memMonitorInterval.unref();
});

// --- Global error handlers ---
// Self-Diagnose: khi bot online, các lỗi này cũng được gửi AI (chuỗi research
// Kira/Mimo) chẩn đoán + đăng đề xuất vá vào kênh log (chỉ khi owner bật).
// diagnoseError giữ nguyên console.error cũ — console vẫn in đủ để pm2 logs đọc.
const selfDiagnose = require("./handlers/selfDiagnose");
process.on("unhandledRejection", (reason) => {
  selfDiagnose.diagnoseError("unhandledRejection", reason).catch(() => {});
});
process.on("uncaughtException", (err) => {
  selfDiagnose.diagnoseError("uncaughtException", err).catch(() => {});
  // Don't exit — PM2 will handle restarts
});

// --- Event handlers ---
client.on("messageCreate", (m) => {
  if (m.author?.bot) return;
  onMessageCreate(client, m, store, heat).catch((e) => console.error("[messageCreate]", e.message));
});
client.on("messageCreate", (m) => {
  if (m.author?.bot) return;
  require("./handlers/filters")(client, m, store, heat).catch((e) => console.error("[filters]", e.message));
});
client.on("interactionCreate", (i) =>
  onInteractionCreate(client, i, store, heat).catch((e) => {
    console.error("[interaction]", e?.message || e);
    try {
      if (!i.replied && !i.deferred && (i.isChatInputCommand() || i.isButton() || i.isStringSelectMenu())) {
        i.reply({ content: "❌ Có lỗi xảy ra khi xử lý lệnh.", ephemeral: true }).catch(() => {});
      }
    } catch {}
  }),
);
client.on("guildMemberAdd", (m) => joinGate(client, m, store).catch((e) => console.error("[joinGate]", e.message)));
client.on("guildCreate", (guild) => {
  console.log(`[guildCreate] ${guild.name} (${guild.id}) — ${client.guilds.cache.size} server`);
  guildSync.syncOne(client, store, guild.id).catch((e) => console.error(`[guildCreate:sync] ${guild.id}:`, e.message));
  // Đảm bảo server mới có đủ module antinuke mặc định (nếu botSyncGuilds bị lỗi).
  guildSync.ensureModules(client, store).catch((e) => console.error(`[guildCreate:ensure] ${guild.id}:`, e.message));
});
client.on("guildDelete", (guild) => {
  console.log(`[guildDelete] ${guild.name ?? guild.id} — ${client.guilds.cache.size} server`);
  guildSync.markGone(client, store, guild.id).catch((e) => console.error(`[guildDelete:sync] ${guild.id}:`, e.message));
});

// --- Voice Presence Tracking (weaker signal, NO fake IP) ---
// Discord does NOT expose individual user IPs via the API.
// Previous code used region:channelId as a pseudo-IP which caused MASSIVE
// false positives — ALL users in the same voice channel were flagged as
// "IP-linked" adding +30 risk score to innocent members.
//
// Replacement: track voice channel co-presence as a WEAK signal only.
// We only flag when the SAME user joins voice from a NEW guild join
// within a short window (not just co-presence).
const voicePresenceMap = new Map(); // guildId -> Map<channelId, Set<userId>>

client.on("voiceStateUpdate", (oldState, newState) => {
  if (!oldState.channelId && newState.channelId && newState.member) {
    const guildId = newState.guild.id;
    const channelId = newState.channelId;
    const userId = newState.member.id;

    void (async () => {
      try {
        const config = await store.getConfig(guildId);
        if (!config?.altDetectionEnabled) return;
        // Track presence for monitoring only — NO IP linking
        if (!voicePresenceMap.has(guildId)) voicePresenceMap.set(guildId, new Map());
        const guildMap = voicePresenceMap.get(guildId);
        if (!guildMap.has(channelId)) guildMap.set(channelId, new Set());
        guildMap.get(channelId).add(userId);
      } catch {}
    })();
  }
  // Remove user from presence when they leave voice
  if (oldState.channelId && !newState.channelId && oldState.member) {
    const guildId = oldState.guild.id;
    const channelId = oldState.channelId;
    const userId = oldState.member.id;
    const guildMap = voicePresenceMap.get(guildId);
    if (guildMap) {
      const chSet = guildMap.get(channelId);
      if (chSet) {
        chSet.delete(userId);
        if (chSet.size === 0) guildMap.delete(channelId);
      }
    }
  }
});

// --- Upgrade C: Periodic Auto-scan Members ---
const ALT_SCAN_INTERVAL = 6 * 60 * 60 * 1000; // 6 hours
const altScanInterval = setInterval(() => {
  void (async () => {
    for (const [, guild] of client.guilds.cache) {
      try {
        const config = await store.getConfig(guild.id);
        if (!config?.altDetectionEnabled) continue;
        // Ensure members are cached
        if (guild.memberCount > guild.members.cache.size) {
          await guild.members.fetch({ limit: 1000 }).catch(() => {});
        }
        const links = scanGuildForAlts(guild, config);
        if (links.length > 0) {
          console.log(`[altScan] ${guild.name}: found ${links.length} potential alt pairs`);
          // Log the top 3 to console
          for (const link of links.slice(0, 3)) {
            console.log(`  - ${link.username1} <-> ${link.username2} (${link.similarity}% via ${link.reason})`);
          }
        }
      } catch (e) {
        console.error(`[altScan] ${guild.id}:`, e.message);
      }
    }
  })().catch(() => {});
}, ALT_SCAN_INTERVAL);
altScanInterval.unref();

// --- Login ---
client.login(process.env.DISCORD_TOKEN).catch((err) => {
  console.error("❌ Không thể đăng nhập Discord:", err.message);
  process.exit(1);
});

// Graceful shutdown
process.on("SIGINT", () => { client.destroy(); process.exit(0); });
process.on("SIGTERM", () => { client.destroy(); process.exit(0); });
