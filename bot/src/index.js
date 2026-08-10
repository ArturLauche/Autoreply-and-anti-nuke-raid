require("dotenv").config();

const { Client, GatewayIntentBits, ActivityType } = require("discord.js");
const ConvexStore = require("./convex");
const guildSync = require("./handlers/guildSync");
const onMessageCreate = require("./handlers/messageCreate");
const onInteractionCreate = require("./handlers/interactionCreate");
const createAntiNuke = require("./handlers/antinuke");
const { runDailyReports } = require("./handlers/dailyReport");
const { registerCommands } = require("./register-slash");

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.GuildModeration,
  ],
});

const store = new ConvexStore();
const antinuke = createAntiNuke(client, store);

client.once("ready", async () => {
  console.log(`✅ Wio đã online: ${client.user.tag} — ${client.guilds.cache.size} server`);

  if (process.env.AUTO_REGISTER_COMMANDS !== "false") {
    try {
      const count = await registerCommands();
      console.log(`✅ Đã đăng ký ${count} slash commands`);
    } catch (err) {
      console.error("⚠️ Đăng ký slash commands thất bại:", err.message);
      console.error("   Chạy thủ công: cd bot && bun run register");
    }
  }

  await guildSync.syncAll(client, store);
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
  setTimeout(() => runDailyReports(client, store).catch((e) => console.error("[report]", e.message)), 30_000);
  setInterval(() => runDailyReports(client, store).catch((e) => console.error("[report]", e.message)), 10 * 60 * 1000);
});

client.on("messageCreate", (m) => onMessageCreate(client, m, store).catch((e) => console.error("[messageCreate]", e.message)));
client.on("interactionCreate", (i) => onInteractionCreate(client, i, store).catch((e) => console.error("[interaction]", e.message)));
client.on("guildCreate", () => guildSync.syncAll(client, store).catch(() => {}));
client.on("guildDelete", () => guildSync.syncAll(client, store).catch(() => {}));

antinuke.attach();

client.login(process.env.DISCORD_TOKEN).catch((err) => {
  console.error("❌ Không thể đăng nhập Discord:", err.message);
  process.exit(1);
});
