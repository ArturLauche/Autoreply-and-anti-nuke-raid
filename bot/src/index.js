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
const guildSync = require("./handlers/guildSync");
const onMessageCreate = require("./handlers/messageCreate");
const onInteractionCreate = require("./handlers/interactionCreate");
const createAntiNuke = require("./handlers/antinuke");
const scanMessage = require("./handlers/filters");
const joinGate = require("./handlers/joinGate");
const { HeatTracker } = require("./heat");
const { runDailyReports } = require("./handlers/dailyReport");
const { registerCommands } = require("./register-slash");
const { setupHidden } = require("./handlers/hidden");

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
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.GuildModeration,
  ],
  // ⚡ Tối ưu RAM: không giữ tin nhắn trong cache (chỉ 1 msg tối đa),
  // giới hạn cache user/member, các cache khác giữ mặc định.
  makeCache: (manager) => {
    if (manager.name === "MessageManager") return new LimitedCollection({ maxSize: 0 });
    if (manager.name === "UserManager" || manager.name === "GuildMemberManager") {
      return new LimitedCollection({ maxSize: 200 });
    }
    return new Collection();
  },
  sweepers: {
    messages: { interval: 900, lifetime: 1800 },
    users: { interval: 900, filter: () => (user) => user.id !== client.user.id },
  },
});

const store = new ConvexStore();
const heat = new HeatTracker(client, store);
const antinuke = createAntiNuke(client, store, heat);

client.once("ready", async () => {
  console.log(`✅ Protogon đã online: ${client.user.tag} — ${client.guilds.cache.size} server`);

  if (process.env.AUTO_REGISTER_COMMANDS !== "false") {
    try {
      const count = await registerCommands();
      console.log(`✅ Đã đăng ký ${count} slash commands`);
    } catch (err) {
      console.error("⚠️ Đăng ký slash commands thất bại:", err.message);
      console.error("   Chạy thủ công: cd bot && bun run register");
    }
  }

  // Best-effort: xác định admin sở hữu bot từ ứng dụng Discord (nếu API trả về).
  try {
    const app = await client.application.fetch();
    const owner = app?.owner;
    // Ưu tiên ownerId (user id của Team owner); chỉ dùng owner.id khi là User thật.
    const ownerId = owner?.ownerId || (/^\d{15,20}$/.test(owner?.id || "") ? owner.id : null);
    if (ownerId) {
      await store.client.mutation("hidden:botSetOwner", { ownerId });
    }
  } catch (e) {
    console.error("[owner] Không xác định được chủ bot qua API:", e.message);
  }

  await guildSync.syncAll(client, store);
  await guildSync.ensureModules(client, store);
  setInterval(() => guildSync.syncAll(client, store), 60_000);

  setInterval(() => {
    client.user.setPresence({
      activities: [
        {
          name: `${client.guilds.cache.size} server · /help`,
          type: ActivityType.Watching,
        },
      ],
      status: "online",
    });
  }, 120_000);

  // Daily anti-nuke report: once shortly after start, then every 10 minutes.
  setTimeout(() => runDailyReports(client, store, heat).catch((e) => console.error("[report]", e.message)), 30_000);
  setInterval(() => runDailyReports(client, store, heat).catch((e) => console.error("[report]", e.message)), 10 * 60 * 1000);

  // Flush pending heat states to Convex so the dashboard stays in sync.
  setInterval(() => heat.flushAll().catch((e) => console.error("[heat:flush]", e.message)), 30_000);
});

client.on("messageCreate", (m) => onMessageCreate(client, m, store).catch((e) => console.error("[messageCreate]", e.message)));
client.on("messageCreate", (m) => scanMessage(client, m, store, heat).catch((e) => console.error("[filters]", e.message)));
client.on("interactionCreate", (i) =>
  onInteractionCreate(client, i, store).catch((e) => {
    console.error("[interaction]", e?.message || e);
    if (e?.errors) console.error("[interaction] details:", JSON.stringify(e.errors).slice(0, 600));
  }),
);
client.on("guildMemberAdd", (m) => joinGate(client, m, store).catch((e) => console.error("[joinGate]", e.message)));
client.on("guildCreate", () => guildSync.syncAll(client, store).catch(() => {}));
client.on("guildDelete", () => guildSync.syncAll(client, store).catch(() => {}));

antinuke.attach();
setupHidden(client, store);

client.login(process.env.DISCORD_TOKEN).catch((err) => {
  console.error("❌ Không thể đăng nhập Discord:", err.message);
  process.exit(1);
});
