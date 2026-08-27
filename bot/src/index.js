// ============================================================
// Protogon Bot — Memory-Optimized Production Entry Point
// Target: 1-1 VPS (1 vCPU, 1GB RAM + 1GB swap)
// ============================================================

require("./loadenv").loadEnv();

const {
  Client,
  GatewayIntentBits,
  ActivityType,
  Collection,
  LimitedCollection,
  Partials,
} = require("discord.js");
const ConvexStore = require("./convex");
const { HeatTracker } = require("./heat");
const guildSync = require("./handlers/guildSync");
const onMessageCreate = require("./handlers/messageCreate");
const onInteractionCreate = require("./handlers/interactionCreate");
const joinGate = require("./handlers/joinGate");

// --- Client config: aggressive memory limits cho 1GB RAM ---
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
    if (manager.name === "MessageManager") return new LimitedCollection({ maxSize: 0 });
    if (manager.name === "UserManager" || manager.name === "GuildMemberManager") {
      return new LimitedCollection({ maxSize: 100 });
    }
    if (manager.name === "PresenceManager" || manager.name === "VoiceStateManager") {
      return new LimitedCollection({ maxSize: 0 });
    }
    if (manager.name === "ReactionManager") return new LimitedCollection({ maxSize: 0 });
    if (manager.name === "GuildEmojiManager") return new LimitedCollection({ maxSize: 50 });
    if (manager.name === "GuildBanManager") return new LimitedCollection({ maxSize: 50 });
    return new Collection();
  },
  sweepers: {
    messages: { interval: 300, lifetime: 600 },
    users: { interval: 300, filter: () => (user) => user.id !== client.user?.id },
    guildMembers: { interval: 300, filter: () => (member) => member.id !== member.guild?.ownerId },
    presences: { interval: 300, filter: () => () => true },
    voiceStates: { interval: 300, filter: () => () => true },
    reactions: { interval: 300, filter: () => () => true },
    guildBans: { interval: 300, filter: () => () => true },
  },
});

const store = new ConvexStore();
const heat = new HeatTracker(client, store);

// --- Memory logging ---
function logMemory(label = "") {
  const used = process.memoryUsage();
  const rss = Math.round(used.rss / 1024 / 1024);
  const heap = Math.round(used.heapUsed / 1024 / 1024);
  console.log(`[mem] ${label} RSS=${rss}MB Heap=${heap}MB`);
}

client.once("ready", async () => {
  logMemory("startup");
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

  // Lazy-init heavy modules
  const antinuke = require("./handlers/antinuke")(client, store, heat);
  const scanMessage = require("./handlers/filters");
  antinuke.attach();
  require("./timeoutWatch").attach(client, store);
  require("./handlers/hidden").setupHidden(client, store);

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

  // Guild sync loop — mỗi 2 phút (giảm từ 1 phút)
  const runSyncLoop = () => {
    void (async () => {
      try {
        const res = await guildSync.syncAll(client, store);
        console.log(`[sync] ${res?.count ?? "?"} server${res?.trustedFullList === false ? " (cache thiếu)" : ""}`);
      } catch (e) {
        console.error("[sync]", e.message);
      }
      setTimeout(runSyncLoop, 120_000);
    })();
  };
  setTimeout(() => {
    void (async () => {
      try { await guildSync.ensureModules(client, store); } catch (e) { console.error("[sync:ensure]", e.message); }
      runSyncLoop();
    })();
  }, 15_000);

  // Presence update — mỗi 2 phút
  const presenceInterval = setInterval(() => {
    client.user.setPresence({
      activities: [{ name: `${client.guilds.cache.size} server · /help`, type: ActivityType.Watching }],
      status: "online",
    });
  }, 120_000);
  presenceInterval.unref();

  // Daily report — mỗi 15 phút (giảm từ 10)
  const { runDailyReports } = require("./handlers/dailyReport");
  setTimeout(() => runDailyReports(client, store, heat).catch((e) => console.error("[report]", e.message)), 30_000);
  const reportInterval = setInterval(
    () => runDailyReports(client, store, heat).catch((e) => console.error("[report]", e.message)),
    15 * 60 * 1000,
  );
  reportInterval.unref();

  // Heat flush — mỗi 60s (giảm từ 30s)
  const heatInterval = setInterval(
    () => heat.flushAll().catch((e) => console.error("[heat:flush]", e.message)),
    60_000,
  );
  heatInterval.unref();

  // Backup poll — mỗi 60s (giảm từ 20s)
  const pollBackups = require("./handlers/backup");
  setTimeout(() => pollBackups(client, store).catch((e) => console.error("[backup]", e.message)), 15_000);
  const backupInterval = setInterval(
    () => pollBackups(client, store).catch((e) => console.error("[backup]", e.message)),
    60_000,
  );
  backupInterval.unref();

  // Auto backup — mỗi 2 giờ (giảm từ 1 giờ)
  const autoBackupInterval = setInterval(
    () => pollBackups.autoBackupSweep(client, store).catch((e) => console.error("[backup:auto]", e.message)),
    2 * 60 * 60 * 1000,
  );
  autoBackupInterval.unref();

  // Memory log — mỗi 5 phút
  const memInterval = setInterval(() => logMemory("periodic"), 5 * 60 * 1000);
  memInterval.unref();

  // Force GC sau startup
  setTimeout(() => {
    if (global.gc) { global.gc(); logMemory("after GC"); }
  }, 30_000);
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
});
client.on("guildDelete", (guild) => {
  console.log(`[guildDelete] ${guild.name ?? guild.id} — ${client.guilds.cache.size} server`);
  guildSync.markGone(client, store, guild.id).catch((e) => console.error(`[guildDelete:sync] ${guild.id}:`, e.message));
});

// --- Login ---
client.login(process.env.DISCORD_TOKEN).catch((err) => {
  console.error("❌ Không thể đăng nhập Discord:", err.message);
  process.exit(1);
});

// Graceful shutdown — quan trọng cho PM2
process.on("SIGINT", () => { client.destroy(); process.exit(0); });
process.on("SIGTERM", () => { client.destroy(); process.exit(0); });
