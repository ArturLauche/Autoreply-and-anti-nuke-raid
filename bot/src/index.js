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
      setTimeout(runSyncLoop, 60_000);
    })();
  };
  setTimeout(() => {
    void (async () => {
      try { await guildSync.ensureModules(client, store); } catch (e) { console.error("[sync:ensure]", e.message); }
      runSyncLoop();
    })();
  }, 5_000);

  // Presence update — mỗi 1 phút
  const presenceInterval = setInterval(() => {
    client.user.setPresence({
      activities: [{ name: `${client.guilds.cache.size} server · /help`, type: ActivityType.Watching }],
      status: "online",
    });
  }, 60_000);
  presenceInterval.unref();

  // Daily report — mỗi 10 phút
  const { runDailyReports } = require("./handlers/dailyReport");
  setTimeout(() => runDailyReports(client, store, heat).catch((e) => console.error("[report]", e.message)), 15_000);
  const reportInterval = setInterval(
    () => runDailyReports(client, store, heat).catch((e) => console.error("[report]", e.message)),
    10 * 60 * 1000,
  );
  reportInterval.unref();

  // Heat flush — mỗi 30s
  const heatInterval = setInterval(
    () => heat.flushAll().catch((e) => console.error("[heat:flush]", e.message)),
    30_000,
  );
  heatInterval.unref();

  // Backup poll — mỗi 20s
  const pollBackups = require("./handlers/backup");
  setTimeout(() => pollBackups(client, store).catch((e) => console.error("[backup]", e.message)), 10_000);
  const backupInterval = setInterval(
    () => pollBackups(client, store).catch((e) => console.error("[backup]", e.message)),
    20_000,
  );
  backupInterval.unref();

  // Auto backup — mỗi 1 giờ
  const autoBackupInterval = setInterval(
    () => pollBackups.autoBackupSweep(client, store).catch((e) => console.error("[backup:auto]", e.message)),
    1 * 60 * 60 * 1000,
  );
  autoBackupInterval.unref();
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

// Graceful shutdown
process.on("SIGINT", () => { client.destroy(); process.exit(0); });
process.on("SIGTERM", () => { client.destroy(); process.exit(0); });
