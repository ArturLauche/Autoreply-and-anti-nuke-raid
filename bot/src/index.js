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
const pollBackups = require("./handlers/backup");

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
    GatewayIntentBits.GuildMessageReactions, // cần để nhận sự kiện reaction (reaction role / giveaway)
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.GuildModeration,
  ],
  // ⚡ Tối ưu RAM: không giữ tin nhắn trong cache (chỉ 1 msg tối đa),
  // giới hạn cache user/member/channel/role, các cache khác giữ tối thiểu.
  makeCache: (manager) => {
    if (manager.name === "MessageManager") return new LimitedCollection({ maxSize: 0 });
    if (manager.name === "UserManager" || manager.name === "GuildMemberManager") {
      return new LimitedCollection({ maxSize: 200 });
    }
    if (manager.name === "PresenceManager" || manager.name === "VoiceStateManager") {
      return new LimitedCollection({ maxSize: 0 });
    }
    if (manager.name === "ReactionManager") return new LimitedCollection({ maxSize: 0 });
    if (manager.name === "GuildEmojiManager") return new LimitedCollection({ maxSize: 100 });
    return new Collection();
  },
  sweepers: {
    messages: { interval: 900, lifetime: 1800 },
    users: { interval: 900, filter: () => (user) => user.id !== client.user.id },
    guildMembers: { interval: 900, filter: () => (member) => member.id !== member.guild.ownerId },
    presences: { interval: 900, filter: () => () => true },
    voiceStates: { interval: 900, filter: () => () => true },
    reactions: { interval: 900, filter: () => () => true },
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
      let ownerName;
      let ownerAvatarUrl;
      try {
        const ownerUser = await client.users.fetch(ownerId).catch(() => null);
        if (ownerUser) {
          ownerName = ownerUser.username;
          ownerAvatarUrl = ownerUser.displayAvatarURL({ size: 256, extension: "png" });
        }
      } catch (e) {
        console.error("[owner:profile]", e.message);
      }
      await store.client.mutation("hidden:botSetOwner", {
        ownerId,
        ownerName,
        ownerAvatarUrl,
      });
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

  // Backup server → GitHub: quét yêu cầu từ dashboard mỗi 20 giây.
  setTimeout(() => pollBackups(client, store).catch((e) => console.error("[backup]", e.message)), 15_000);
  setInterval(() => pollBackups(client, store).catch((e) => console.error("[backup]", e.message)), 20_000);

  // Tự động backup định kỳ (2-30 ngày theo cấu hình từng server): quét mỗi giờ.
  setTimeout(() => pollBackups.autoBackupSweep(client, store).catch((e) => console.error("[backup:auto]", e.message)), 60_000);
  setInterval(() => pollBackups.autoBackupSweep(client, store).catch((e) => console.error("[backup:auto]", e.message)), 60 * 60 * 1000);
});

client.on("messageCreate", (m) => onMessageCreate(client, m, store, heat).catch((e) => console.error("[messageCreate]", e.message)));
client.on("messageCreate", (m) => scanMessage(client, m, store, heat).catch((e) => console.error("[filters]", e.message)));
client.on("interactionCreate", (i) =>
  onInteractionCreate(client, i, store, heat).catch((e) => {
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
